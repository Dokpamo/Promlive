// Both mobile platforms own keyboard layout on the UI thread. The iOS view
// follows UIKeyboardLayoutGuide; Android follows WindowInsetsAnimation.
export {ChatKeyboardProvider, ChatKeyboardBody, ChatKeyboardDock, dismissChatKeyboard} from './KeyboardDock.android';
