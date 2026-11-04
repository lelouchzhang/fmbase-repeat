import { RegisterInput } from '@fmbase/types';
import { IsEmail, IsString, MinLength } from 'class-validator';
export class RegisterDto implements RegisterInput {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  name: string;
}
