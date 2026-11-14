import {createWorkspace} from './workspace.js';
import {installTracking} from './tracking.js';
import {installReview} from './review.js';
import {installConnection} from './connection.js';
import {installStorage} from './storage-page.js';

const workspace=createWorkspace();
installTracking(workspace);
installReview(workspace);
installConnection(workspace);
installStorage(workspace);
await workspace.start();
