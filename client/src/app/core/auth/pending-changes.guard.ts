import { CanDeactivateFn } from '@angular/router';

export const pendingChangesGuard: CanDeactivateFn<{ canLeave: () => Promise<boolean> }> =
  component => component.canLeave();
