import { flow as dashboardFlow } from './dashboard';
import { flow as ajoThriftFlow } from './ajo-thrift';
import type { Flow } from './dashboard';

/** Add new flow files here as docs sections get screenshots (D2+). */
export const flows: Flow[] = [dashboardFlow, ajoThriftFlow];
