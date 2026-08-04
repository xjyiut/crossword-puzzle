import { ICrosswordDefinition } from '../models/ICrossword';
import raw from './crossword.json';

/**
 * Single place the puzzle content enters the app.
 * Replace `crossword.json` (or point this at a REST/SharePoint list call)
 * and the grid rebuilds itself — no layout work required.
 */
const definition: ICrosswordDefinition = raw as unknown as ICrosswordDefinition;

export default definition;
