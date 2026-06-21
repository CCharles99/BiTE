interface Piece {
  file: 'og' | 'add';
  start: number;
  length: number;
}

interface originalFileData {
  data: string;
}


declare global {
  interface Window {
    fileOps: {
      read: (name: string) => Promise<originalFileData>
    }
  }
}

export default class FileData {
  fileName: string;
  ogFile: string;
  addFile: string;
  pieceTable: Piece[];
  constructor(name: string) {
    this.fileName = name;
    this.pieceTable = [];
    this.addFile = '';
    this.ogFile = '';
  }

  async loadData() {
    const { data } = await window.fileOps.read(this.fileName);
    this.pieceTable.push({
      file: 'og',
      start: 0,
      length: data.length,
    })
    this.ogFile = data;
  }

  getLength(): number {
    return this.pieceTable.length;
  }

  getText(): string[] {
    let text = ''
    this.pieceTable.forEach(piece => {
      if (piece.file === 'og') {
        text += this.ogFile.slice(piece.start, piece.start + piece.length);
      } else {
        text += this.addFile.slice(piece.start, piece.start + piece.length);
      }
    });
    return text.split('\r\n');
  }

  getTextSegment(startTextIndex: number, endTextIndex: number): string {
    let text = ''
    if (startTextIndex < 0 || startTextIndex >= endTextIndex) return text;
    const [firstPieceIndex, firstOffset] = this.getPieceIndex(startTextIndex);
    const [lastPieceIndex, lastOffset] = this.getPieceIndex(endTextIndex);
    for (let pieceIndex = firstPieceIndex; pieceIndex <= lastPieceIndex; pieceIndex++) {
      const piece = this.pieceTable[pieceIndex]
      const startFileIndex = (pieceIndex === firstPieceIndex) ? piece.start + firstOffset : piece.start
      const endFileIndex = (pieceIndex === lastPieceIndex) ? piece.start + lastOffset : piece.length
      if (piece.file === 'og') {
        text += this.ogFile.slice(startFileIndex, endFileIndex);
      } else {
        text += this.addFile.slice(startFileIndex, endFileIndex);
      }
    }
    return text
  }

  private getPieceIndex(textIndex: number): [number, number] {
    let index = -1;
    let acc = 0; // accumulated length of pieces
    let offset = 0; // distance from the start of the indexed piece to the column
    for (let i = 0; i < this.pieceTable.length; i++) {
      acc += this.pieceTable[i].length;
      if (acc > textIndex) {
        index = i;
        offset = textIndex - (acc - this.pieceTable[i].length);
        return [index, offset];
      }
    }
    return [index, offset];
  }

  insert(textIndex: number, text: string) {
    // create a new piece for the inserted text
    const insertedPiece: Piece = {
      file: 'add',
      start: this.addFile.length,
      length: text.length,
    };
    // insert text into addFile
    this.addFile += text;
    // update pieceTable
    const [index, offset] = this.getPieceIndex(textIndex);
    if (index === -1) {
      // when writing to the end of the line, new piece can be appended
      let prevPiece = this.pieceTable[this.pieceTable.length - 1];
      if (prevPiece.start + prevPiece.length === insertedPiece.start) {
        prevPiece.length += insertedPiece.length;
      } else {
        this.pieceTable.push(insertedPiece);
      }
    } else if (offset === 0) {
      // when writing between pieces, the new piece can be prepended or inserted
      let prevPiece = this.pieceTable[index - 1];
      if (prevPiece?.start + prevPiece?.length === insertedPiece.start) {
        prevPiece.length += insertedPiece.length;
      } else {
        this.pieceTable.splice(index, 0, insertedPiece);
      }
    } else {
      const piece = this.pieceTable[index];
      // when writing to the middle of a piece, the existing piece should be split
      const leftPiece: Piece = {
        file: piece.file,
        start: piece.start,
        length: offset
      }
      const rightPiece: Piece = {
        file: piece.file,
        start: piece.start + offset,
        length: piece.length - offset,
      }
      this.pieceTable.splice(index, 1, leftPiece, insertedPiece, rightPiece);
    }
  }

  delete(startTextIndex: number, endTextIndex: number) {
    if (startTextIndex < 0 || startTextIndex >= endTextIndex) return;
    const [firstPieceIndex, firstOffset] = this.getPieceIndex(startTextIndex);
    const [lastPieceIndex, lastOffset] = this.getPieceIndex(endTextIndex);
    if (firstPieceIndex < 0 || lastPieceIndex < 0) return;
    if (firstPieceIndex === lastPieceIndex) {
      const deleteLength = lastOffset - firstOffset;
      const piece = this.pieceTable[firstPieceIndex];
      if (firstOffset === 0) {
        piece.start += deleteLength;
        piece.length -= deleteLength;
      } else if (lastOffset === piece.length) {
        piece.length -= deleteLength;
      } else {
        const leftPiece: Piece = {
          file: piece.file,
          start: piece.start,
          length: firstOffset
        }
        const rightPiece: Piece = {
          file: piece.file,
          start: piece.start + lastOffset,
          length: piece.length - lastOffset,
        }
        this.pieceTable.splice(firstPieceIndex, 1, leftPiece, rightPiece);
      }
      // remove piece with length no length
      if (piece.length == 0) {
        this.pieceTable.splice(lastPieceIndex, 1)
      }
    } else {
      const firstPiece = this.pieceTable[firstPieceIndex]
      firstPiece.length = firstOffset
      const lastPiece = this.pieceTable[lastPieceIndex]
      lastPiece.start += lastOffset
      lastPiece.length -= lastOffset
      this.pieceTable.splice(firstPieceIndex+1, lastPieceIndex - firstPieceIndex - 1)
    }
  }
}