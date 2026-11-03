import { CreateOrganizationInput } from '@fmbase/types';
import { IsString, MinLength } from 'class-validator';

export class CreateOrganizationDto implements CreateOrganizationInput {
  @IsString()
  @MinLength(3)
  name: string;
}
