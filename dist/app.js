import {createWorkspace} from './workspace.js';
import {installTracking} from './tracking.js';
import {installReview} from './review.js';

const workspace=createWorkspace();
installTracking(workspace);
installReview(workspace);
await workspace.start();
