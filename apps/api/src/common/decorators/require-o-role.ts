import { ORG_ROLE_KEY } from '@fmbase/constants';
import { RoleInOrganization } from '@fmbase/types';

import { SetMetadata } from '@nestjs/common';

export const RequireOrgRole = (role: RoleInOrganization) =>
  SetMetadata(ORG_ROLE_KEY, role);
