import { CompleteOut } from './BaseTypes';
import { Email, IranPhoneNumber, StrongPassword, Username } from './TypeAliases';

export interface UserCompactIn {
  phoneNumber: IranPhoneNumber;
  password: StrongPassword;
  username?: Username;
  email?: Email;
}

export interface UserCompleteOut extends CompleteOut {
  phoneNumber?: IranPhoneNumber | null;
  username?: Username | null;
  email?: Email | null;
}
