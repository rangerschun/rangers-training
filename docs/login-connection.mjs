// Install the shared connection before the retained application starts.
import {installGoogleBridge} from './google-bridge.mjs?v=integrated-login-20261031';
import {TRAINING_BACKEND_CONFIG} from './training-config.mjs';
installGoogleBridge(TRAINING_BACKEND_CONFIG);
