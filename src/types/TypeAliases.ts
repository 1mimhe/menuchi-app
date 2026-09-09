/**
 * Stringified UUIDv4.
 * See [RFC 4112](https://tools.ietf.org/html/rfc4122)
 * @pattern [0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-4[0-9A-Fa-f]{3}-[89ABab][0-9A-Fa-f]{3}-[0-9A-Fa-f]{12} is not a valid UUID
 * @format uuid
 * @example "52907745-7672-470e-a803-a2f8feb52944"
 */
export type UUID = string;

/**
 * Username format.
 * Must be 3-30 characters long, containing only letters, numbers, underscores, and hyphens.
 * @pattern ^[a-zA-Z0-9_-]{3,30}$
 */
export type Username = string;

/**
 * Strong password format.
 * Must be 8-64 characters long, containing at least one uppercase letter,
 * one lowercase letter, one number, and one special character (@, $, !, %, *, ?, &).
 * @pattern ^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,64}$
 * @example P@ssword1234
 */
export type StrongPassword = string;

/**
 * Email address format.
 * @pattern ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ is not a valid email
 * @format email
 * @example "example@example.com"
 */
export type Email = string;

/**
 * Iran phone number format.
 * Supported format: 09123456789
 * @pattern ^0?9\d{9}$ is not a valid phone number
 */
export type IranPhoneNumber = string;

/**
 * URL format.
 * @pattern ^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$ is not a valid URL
 * @format uri
 * @example "https://example.com/example"
 */
export type URL = string;

/**
 * @isString should be a string
 * @minLength 2 length must be between 2 and 50
 * @maxLength 50 length must be between 2 and 50
 * @example "string"
 */
export type DefaultString = string;

/**
 * @isString should be a string
 * @minLength 2 length must be between 2 and 300
 * @maxLength 300 length must be between 2 and 300
 */
export type LongString = string;

/**
 * @isInt number should be integer
 */
export type Int = number;

/**
 * @isBoolean should be boolean
 * @example true
 */
export type Boolean = boolean;

/**
 * URL-friendly string identifier.
 * Contains only English letters, numbers, and hyphens.
 * @pattern ^[a-zA-Z0-9-]+$
 * @minLength 2 length must be between 2 and 50
 * @maxLength 50 length must be between 2 and 50
 * @format slug
 * @example "my-name"
 */
export type Slug = string;

/**
 * Valid filename for images with allowed extensions.
 * Contains only English letters, numbers, hyphens, and underscores.
 * Must end with a valid image extension (.jpg, .jpeg, .png, .webp, .svg, .heic).
 * @pattern ^[a-zA-Z0-9-_]+\.(jpg|jpeg|png|webp|svg|heic)$
 * @minLength 5 length must be between 5 and 255
 * @maxLength 255 length must be between 5 and 255
 * @format image-filename
 * @example "my-image.jpg"
 * @example "photo_123.png"
 */
export type ImageFilename = string;

/**
 * A 5-digit One-Time Password (OTP).
 * Contains exactly 5 numeric digits (0-9).
 * Must be a string of length 5.
 * @pattern ^\d{5}$
 * @minLength 5
 * @maxLength 5
 * @format otp-5-digit
 * @example "12345"
 */
export type OTP = string;

/**
 * Time period in 24-hour format.
 * Must follow the format HH:MM-HH:MM (e.g., 09:00-20:00).
 * Hours must be from 00 to 23, and minutes from 00 to 59.
 * @pattern ^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$
 * @example 09:00-20:00
 */
export type TimePeriod = string;
