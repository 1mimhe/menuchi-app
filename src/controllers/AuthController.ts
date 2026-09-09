import { Body, Post, Request, Response, Route, SuccessResponse, Tags } from 'tsoa';
import { ConstraintsDatabaseError } from '../exceptions/DatabaseError';
import { UserCompactIn, UserCompleteOut } from '../types/UserTypes';
import { CheckOtpIn, SendOtpIn, UserLogin } from '../types/AuthTypes';
import { UserValidationError } from '../exceptions/ValidationError';
import express from 'express';
import { CookieNames, RolesEnum } from '../types/Enums';
import BaseController from './BaseController';
import { InvalidCredentialsError } from '../exceptions/AuthError';
import MenuchiError from '../exceptions/MenuchiError';
import { getOtpRedisClient } from '../config/OtpRedisClient';
import { resolveContainer } from '../container';

function readEnv() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getEnv } = require('../config/env') as typeof import('../config/env');
    return getEnv();
  } catch {
    return process.env as unknown as Record<string, string>;
  }
}

@Route('/auth')
@Tags('Auth')
export class AuthController extends BaseController {
  /**
   * Registers a new restaurant owner.
   */
  @Response<ConstraintsDatabaseError>(
    409,
    'ConstraintsDatabaseError -> A user with the provided credentials already exists.'
  )
  @Response<UserValidationError>(422, '4225 UserValidationError')
  @SuccessResponse(201, 'User signed up successfully.')
  @Post('/res-signup')
  public async restaurantOwnerSignup(
    @Body() body: UserCompactIn,
    @Request() req?: express.Request
  ): Promise<UserCompleteOut> {
    return resolveContainer(req).auth.signup(body);
  }

  /**
   * Authenticates a restaurant owner.
   */
  @Response<InvalidCredentialsError>(401, 'InvalidCredentialsError')
  @SuccessResponse(200, 'User signed in successfully.')
  @Post('/res-signin')
  public async restaurantOwnerSignin(
    @Body() body: UserLogin,
    @Request() req: express.Request
  ): Promise<boolean> {
    if (req.session.user) return true;

    const { accessToken, user } = await resolveContainer(req).auth.signin(body);

    const isProduction = readEnv().NODE_ENV === 'production';
    req.res?.cookie(CookieNames.AccessToken, accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 2 * 24 * 3600 * 1000,
      path: '/',
    });

    req.session.accessToken = accessToken;
    req.session.user = user;
    req.session.lastAccessed = new Date();

    return true;
  }

  /**
   * Sends an OTP to the email.
   */
  @SuccessResponse(200, 'Otp code sent successfully.')
  @Post('/send-otp')
  public async sendOtp(@Body() body: SendOtpIn): Promise<boolean> {
    const streamName = readEnv().OTP_STREAM as string;
    await getOtpRedisClient().xAdd(streamName, '*', { email: body.email });
    return true;
  }

  /**
   * Sends email and OTP for auth.
   */
  @SuccessResponse(200, 'User authenticated successfully.')
  @Post('/check-otp')
  public async checkOtp(
    @Body() body: CheckOtpIn,
    @Request() req: express.Request
  ): Promise<boolean> {
    // Brute-force guard: max 5 attempts per email per 10 minutes.
    const otpRedis = getOtpRedisClient();
    const attemptsKey = `otp:attempts:${body.email}`;
    const attempts = await otpRedis.incr(attemptsKey);
    if (attempts === 1) await otpRedis.expire(attemptsKey, 600);
    if (attempts > 5) {
      throw new MenuchiError('Too many OTP attempts. Try again later.', 429);
    }

    const e = readEnv();
    const otpService = `${e.INTERNAL_OTP_URL}${e.INTERNAL_OTP_ENDPOINT}/${body.email}`;
    let otpCode: unknown;
    try {
      const res = await fetch(otpService, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`OTP service responded ${res.status}`);
      ({ code: otpCode } = (await res.json()) as { code: unknown });
    } catch {
      throw new MenuchiError('OTP verification service unavailable.', 502);
    }

    if (body.code === otpCode) {
      const payload = {
        userId: body.email,
        roles: [RolesEnum.RestaurantCustomer],
      };
      const accessToken = resolveContainer(req).auth.generateAuthToken(payload);

      const isProduction = readEnv().NODE_ENV === 'production';
      req.res?.cookie(CookieNames.AccessToken, accessToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 2 * 24 * 3600 * 1000,
        path: '/',
      });

      req.session.accessToken = accessToken;
      // Customer identity: session id is the verified OTP email (see
      // OrderController.createOrder). Initialise order tracking here so
      // recentlyOrderIds is never undefined downstream.
      req.session.user = { id: body.email, recentlyOrderIds: [] };
      req.session.lastAccessed = new Date();
      await getOtpRedisClient().del(attemptsKey);
    } else throw new InvalidCredentialsError();

    return true;
  }

  /**
   * Logs out the current user.
   */
  @SuccessResponse(200, 'User logged out successfully.')
  @Post('/logout')
  public async logout(@Request() req: express.Request): Promise<boolean> {
    await new Promise<void>((resolve, reject) => {
      req.session.destroy((err?: unknown) => (err ? reject(err) : resolve()));
    });
    const cookieOptions = {
      path: '/',
      sameSite: 'lax' as const,
      secure: readEnv().NODE_ENV === 'production',
      httpOnly: true,
    };
    req.res?.clearCookie(CookieNames.AccessToken, cookieOptions);
    req.res?.clearCookie(CookieNames.SessionId, cookieOptions);
    return true;
  }
}
