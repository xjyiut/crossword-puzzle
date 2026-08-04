import * as React from 'react';
import { DialogAction, IDialogButton, IDialogState } from '../hooks/useCrossword';
import styles from '../Crossword.module.scss';

export interface IDialogProps {
  dialog: IDialogState;
  onAction: (action: DialogAction) => void;
}

/**
 * Modal pop-up. Focus moves to the primary button on open, Escape triggers the
 * dismissing button when there is one, and Tab is trapped inside the card so
 * keyboard users cannot wander back into the grid behind it.
 */
const Dialog: React.FC<IDialogProps> = (props: IDialogProps) => {
  const { dialog, onAction } = props;
  const cardRef: React.RefObject<HTMLDivElement> = React.useRef<HTMLDivElement>(null);
  const primaryRef: React.RefObject<HTMLButtonElement> = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (primaryRef.current) { primaryRef.current.focus(); }
  }, [dialog]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      for (let i: number = 0; i < dialog.buttons.length; i++) {
        if (dialog.buttons[i].action === 'close') {
          event.preventDefault();
          onAction('close');
          return;
        }
      }
      return;
    }

    if (event.key !== 'Tab' || !cardRef.current) { return; }

    const focusable: HTMLButtonElement[] = [].slice.call(
      cardRef.current.querySelectorAll('button')
    ) as HTMLButtonElement[];
    if (focusable.length === 0) { return; }

    const first: HTMLButtonElement = focusable[0];
    const last: HTMLButtonElement = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className={styles.dialogBackdrop} onKeyDown={onKeyDown}>
      <div
        ref={cardRef}
        className={styles.dialog}
        role="alertdialog"
        aria-modal={true}
        aria-label={dialog.message}
      >
        <p className={styles.dialogMessage}>{dialog.message}</p>
        <div className={styles.dialogButtons}>
          {dialog.buttons.map((button: IDialogButton, index: number) => (
            <button
              key={button.action + '-' + index}
              ref={button.primary ? primaryRef : undefined}
              type="button"
              className={
                button.primary
                  ? styles.dialogButton
                  : styles.dialogButton + ' ' + styles.dialogButtonSecondary
              }
              onClick={() => onAction(button.action)}
            >
              {button.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dialog;
