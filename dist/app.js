import {createWorkspace} from './workspace.js';
import {installTracking} from './tracking.js';

const workspace=createWorkspace();
installTracking(workspace);
await workspace.start();
