/** Everything a pop-up button can do. */
export type DialogAction =
  | 'close'              // "Try again" -- just dismiss
  | 'gridTryAgain'       // dismiss, and wipe the wrong letters off the grid
  | 'gridShowAnswer'     // fill the solution in, keep the tick marks
  | 'giveUp'             // -> "are you sure?"
  | 'revealBonusAnswer'  // -> the answer itself
  | 'finish';            // "Continue"

export interface IDialogButton {
  label: string;
  action: DialogAction;
  primary: boolean;
}

export interface IDialogState {
  message: string;
  buttons: IDialogButton[];
}
