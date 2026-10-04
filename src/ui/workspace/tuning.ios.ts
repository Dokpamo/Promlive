import {workspaceDefaults} from './tuningDefaults';
// UIKit keeps this bounded window mounted to preserve real message anchors.
export const workspaceTuning = {...workspaceDefaults, retainedMessages: 96};
