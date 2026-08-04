import * as React from 'react';
import * as ReactDOM from 'react-dom';
import Crossword from './crossword/Crossword';
import './global.scss';

/**
 * Standalone host only. In SharePoint the SPFx web part renders <Crossword />
 * instead — see README.md.
 */
ReactDOM.render(
  <React.StrictMode>
    <div className="app">
      <Crossword showWarnings={true} showHeader={true} showReset={true} />
    </div>
  </React.StrictMode>,
  document.getElementById('root')
);
