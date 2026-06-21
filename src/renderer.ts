/**
 * This file will automatically be loaded by vite and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/application-architecture#main-and-renderer-processes
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.ts` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */
/**
 * @todo
 * - Writes
 * - UI
 * - Working Directory with File Tree
 * - Tabs
 */
import FileData from './file';

type FilePosition = {
  line: number,
  column: number
}
type Cursor = {
  current: FilePosition,
  prev: FilePosition,
  isVisible: boolean,
  isActive: boolean
}
let cursor: Cursor = {
  current: { line: 0, column: 0 },
  prev: { line: 0, column: 0 },
  isVisible: false,
  isActive: false
}

type Highlight = {
  pivot: FilePosition
  isActive: boolean
}

let highlight: Highlight = {
  pivot: { line: 0, column: 0 },
  isActive: false
};

let clearCursor: NodeJS.Timeout | null = null;
let file: FileData;
let columnsPerLine: number[] = []
let canvas = document.getElementById('file') as HTMLCanvasElement;
let charWidth = 0;
let fontSize = 14;
let lineHeight = fontSize * 1.4;

const drawText = () => {
  let ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  // clear the canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  // draw text
  ctx.fillStyle = 'black';
  const text = file.getText();
  columnsPerLine = []
  text.forEach((lineText, lineNo) => {
    columnsPerLine.push(lineText.length)
    ctx.fillText(lineText, 2, (lineNo + 0.5) * lineHeight);
  })
}

function positionToTextIndex(position: FilePosition) {
  let index = position.column
  for (const lineLength of columnsPerLine.slice(0, position.line)) {
    index += lineLength + 2
  }
  return index
}

const drawCursor = () => {
  const { line, column } = cursor.current

  let ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.beginPath();
  ctx.moveTo(2 + column * charWidth, line * lineHeight);
  ctx.lineTo(2 + column * charWidth, (line + 1) * lineHeight);
  ctx.stroke();
  ctx.closePath();
}

const activateCursor = () => {
  if (clearCursor) {
    clearInterval(clearCursor);
    if (cursor.isVisible) {
      cursor.isVisible = false
      render()
    }
  }
  cursor.isVisible = true;
  render();

  clearCursor = setInterval(() => {
    cursor.isVisible = !cursor.isVisible;
    render();
    if (!cursor.isVisible) return;
  }, 700)
  return;
};

const handleCursorMove = (e: MouseEvent) => {
  const { offsetX, offsetY } = e;
  let line = Math.floor(offsetY / lineHeight);
  line = (line < columnsPerLine.length) ? line : columnsPerLine.length
  let column = Math.floor(offsetX / charWidth);
  column = (column < columnsPerLine[line]) ? column : columnsPerLine[line]

  if (line === cursor.current.line && column === cursor.current.column) return;
  cursor.prev = { ...cursor.current }
  cursor.current = { line, column }
  activateCursor();
};

const drawHighlight = () => {
  const isCursorGreaterThanPivot = isGreaterPositionThan(cursor.current, highlight.pivot);
  const startPosition = isCursorGreaterThanPivot ? { ...highlight.pivot } : { ...cursor.current };
  const endPosition = isCursorGreaterThanPivot ? { ...cursor.current } : { ...highlight.pivot };
  for (let line = startPosition.line; line <= endPosition.line; line++) {
    const startCol = (line === startPosition.line) ? startPosition.column : 0
    const endCol = (line === endPosition.line) ? endPosition.column : columnsPerLine[line] + 1
    drawHighlightLine(line, startCol, endCol);
  }
}

const drawHighlightLine = (line: number, startCol: number, endCol: number) => {
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.fillStyle = 'rgba(0, 0, 255, 0.5)';
  ctx.fillRect(2 + startCol * charWidth, line * lineHeight, (endCol - startCol) * charWidth, lineHeight);
}

const onCanvasClick = (e: MouseEvent) => {
  const { shiftKey } = e;
  if (shiftKey && !highlight.isActive) {
    highlight.isActive = true
    highlight.pivot = { ...cursor.prev }
  } else if (!shiftKey && highlight.isActive) {
    highlight.isActive = false;
  }
  handleCursorMove(e);

  canvas.addEventListener('mousemove', onMouseHold);
  return;
};

const onMouseHold = (e: MouseEvent) => {
  if (!highlight.isActive) {
    highlight.isActive = true
    highlight.pivot = { ...cursor.current }
  }
  handleCursorMove(e);
  render();
}

window.addEventListener('keydown', async (e) => {
  let firstPosition;
  let lastPosition;
  let firstTextIndex;
  let lastTextIndex;
  if (highlight.isActive) {
    const isCursorGreaterThanPivot = isGreaterPositionThan(cursor.current, highlight.pivot);
    firstPosition = isCursorGreaterThanPivot ? { ...highlight.pivot } : { ...cursor.current }
    lastPosition = isCursorGreaterThanPivot ? { ...cursor.current } : { ...highlight.pivot }
    firstTextIndex = positionToTextIndex(firstPosition);
    lastTextIndex = positionToTextIndex(lastPosition);
  } else {
    firstPosition = { ...cursor.current }
    firstTextIndex = positionToTextIndex(firstPosition);
    lastTextIndex = firstTextIndex + 1
  }

  cursor.prev = { ...cursor.current };
  if (e.ctrlKey) {
    if (e.key === 'c') {
      if (!highlight.isActive) return;
      const copiedText = file.getTextSegment(firstTextIndex, lastTextIndex)
      navigator.clipboard.writeText(copiedText)
      navigator.clipboard.readText().then(text => console.log(text.length))
      return;
    } else if (e.key === 'v') {
      if (highlight.isActive) {
        cursor.current = firstPosition;
        file.delete(firstTextIndex, lastTextIndex);
        highlight.isActive = false
      }
      const text = await navigator.clipboard.readText()
      file.insert(firstTextIndex, text);
      const lines = text.split('\r\n')
      cursor.current.line += lines.length - 1
      cursor.current.column = (lines.length > 1) ? lines[lines.length - 1].length : cursor.current.column + text.length
    } else if (e.key === 'x') {
      if (!highlight.isActive) return;
      const copiedText = file.getTextSegment(firstTextIndex, lastTextIndex)
      navigator.clipboard.writeText(copiedText)
      navigator.clipboard.readText().then(text => console.log(text.length))
      cursor.current = firstPosition;
      file.delete(firstTextIndex, lastTextIndex);
      highlight.isActive = false
    }
  } else if (e.key === 'Backspace') {
    if (highlight.isActive) {
      cursor.current = firstPosition;
      file.delete(firstTextIndex, lastTextIndex);
      highlight.isActive = false
    } else {
      if (cursor.current.column > 0) {
        cursor.current.column--
      } else if (cursor.current.line > 0) {
        cursor.current.line--
        cursor.current.column = columnsPerLine[cursor.current.line]
      } else {
        return;
      }
      file.delete(firstTextIndex - 1, firstTextIndex);
    }
  } else if (e.key === 'Delete') {
    cursor.current = firstPosition;
    file.delete(firstTextIndex, lastTextIndex);
    highlight.isActive = false
  } else if (e.key.startsWith('Arrow')) {
    if (e.key === 'ArrowUp' && cursor.current.line > 0) {
      cursor.current.line--;
      cursor.current.column = Math.min(cursor.current.column, columnsPerLine[cursor.current.line]);
    } else if (e.key === 'ArrowDown' && cursor.current.line < columnsPerLine.length - 1) {
      cursor.current.line++;
      cursor.current.column = Math.min(cursor.current.column, columnsPerLine[cursor.current.line]);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (cursor.current.column > 0) {
        cursor.current.column--
      } else if (cursor.current.line > 0) {
        cursor.current.line--;
        cursor.current.column = columnsPerLine[cursor.current.line];
      } else {
        return;
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (cursor.current.column < columnsPerLine[cursor.current.line]) {
        cursor.current.column++
      } else if (cursor.current.line < columnsPerLine.length - 1) {
        cursor.current.line++;
        cursor.current.column = 0;
      } else {
        return;
      }
    } else {
      return;
    }
    if (!e.shiftKey && highlight.isActive) {
      highlight.isActive = false
    } else if (e.shiftKey && !highlight.isActive) {
      highlight.isActive = true
      highlight.pivot = { ...cursor.prev }
    }

  } else if (e.key == 'Enter') {
    if (highlight.isActive) {
      file.delete(firstTextIndex, lastTextIndex);
      highlight.isActive = false
    }
    file.insert(firstTextIndex, '\r\n')
    cursor.current.line++
    cursor.current.column = 0
  } else if (e.key.length === 1) {
    if (highlight.isActive) {
      file.delete(firstTextIndex, lastTextIndex);
      highlight.isActive = false
    }
    file.insert(firstTextIndex, e.key)
    cursor.current.column++
  } else {
    return;
  }
  activateCursor();
  render();
  return;
});

function render() {
  drawText()
  if (cursor.isVisible) drawCursor();
  if (highlight.isActive) drawHighlight();
}
const isGreaterPositionThan = (pos1: FilePosition, pos2: FilePosition): boolean | null => {
  if (pos1.line > pos2.line) {
    return true;
  } else if (pos1.line < pos2.line) {
    return false;
  } else {
    // if the lines are equal, compare the columns
    if (pos1.column > pos2.column) {
      return true;
    } else if (pos1.column < pos2.column) {
      return false;
    } else {
      return null;
    }
  }
}

const renderFile = async () => {
  file = new FileData('sample1.txt');
  await file.loadData();
  canvas.width = 2048;
  canvas.height = 20 * lineHeight;
  let ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  ctx.font = `${fontSize}px Consolas`;
  ctx.textBaseline = 'middle'
  charWidth = ctx.measureText(' ').width;
  canvas.addEventListener('mousedown', onCanvasClick);
  canvas.addEventListener('mouseup', () => {
    canvas.removeEventListener('mousemove', onMouseHold);
  })
  drawText()
  return;
}

renderFile();