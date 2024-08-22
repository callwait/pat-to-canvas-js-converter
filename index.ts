// Constants
const STROKE_WIDTH = 1;
const DRAW_MINIMUM = 50;
const DRAW_MAXIMUM = 10000;

const COLORS = {
    background: "#fff",
    lines: "#222"
};

const DEFAULT_SETTINGS: CanvasSettings = {
    width: 640,
    height: 480,
    scale: 1,
    color: COLORS.lines
};

// Types
type CanvasSettings = {
    width: number;
    height: number;
    scale: number;
    color?: string;
};

type Point = {
    x: number;
    y: number;
};

type Paddings = {
    bottomRight: Point;
    topRight: Point;
    bottomLeft: Point;
    topLeft: Point;
};

type LineIntersection = {
    point: Point | null;
    onLine1: boolean;
    onLine2: boolean;
};

type PatternRow = {
    cells: number[];
};

// Helper functions
function getCanvasCenter(settings: CanvasSettings): Point {
    return {
        x: settings.width / 2,
        y: settings.height / 2
    };
}

function calculatePaddings(settings: CanvasSettings): Paddings {
    const { width, height, scale } = settings;
    const halfWidth = width / (2 * scale);
    const halfHeight = height / (2 * scale);

    return {
        bottomRight: { x: halfWidth, y: halfHeight },
        topRight: { x: halfWidth, y: -halfHeight },
        bottomLeft: { x: -halfWidth, y: halfHeight },
        topLeft: { x: -halfWidth, y: -halfHeight }
    };
}

function setCanvasDimensions(canvas: HTMLCanvasElement, settings: CanvasSettings): void {
    canvas.setAttribute("width", settings.width.toString());
    canvas.setAttribute("height", settings.height.toString());
}

function initialDrawingSettings(context: CanvasRenderingContext2D, settings: CanvasSettings): void {
    const gridSideDimensions = getCanvasCenter(settings);
    const scale = settings.scale;
    context.fillStyle = COLORS.background;
    context.fillRect(0, 0, settings.width, settings.height);
    context.beginPath();
    context.rect(0, 0, settings.width, settings.height);
    context.fill();
    context.translate(gridSideDimensions.x, gridSideDimensions.y);
    context.scale(scale, scale);
    context.strokeStyle = settings.color || COLORS.lines;
    context.lineWidth = STROKE_WIDTH / scale;
}

function intersect(minA: number, maxA: number, value: number): boolean {
    return minA <= value && value < maxA;
}

function checkLineIntersection(
    line1StartX: number, line1StartY: number, line1EndX: number, line1EndY: number,
    line2StartX: number, line2StartY: number, line2EndX: number, line2EndY: number
): LineIntersection {
    const denominator = (line2EndY - line2StartY) * (line1EndX - line1StartX) - (line2EndX - line2StartX) * (line1EndY - line1StartY);
    if (denominator === 0) {
        return { point: null, onLine1: false, onLine2: false };
    }
    const a = line1StartY - line2StartY;
    const b = line1StartX - line2StartX;
    const numerator1 = (line2EndX - line2StartX) * a - (line2EndY - line2StartY) * b;
    const numerator2 = (line1EndX - line1StartX) * a - (line1EndY - line1StartY) * b;
    const aRatio = numerator1 / denominator;
    const bRatio = numerator2 / denominator;
    const resultX = line1StartX + aRatio * (line1EndX - line1StartX);
    const resultY = line1StartY + aRatio * (line1EndY - line1StartY);
    return {
        point: { x: resultX, y: resultY },
        onLine1: intersect(0.0, 1.0, aRatio),
        onLine2: intersect(0.0, 1.0, bRatio)
    };
}

function drawRow(
    context: CanvasRenderingContext2D,
    paddings: Paddings,
    rowCells: number[],
    perpOffset: number,
    factor: number
): boolean | undefined {
    const dasharray = rowCells.slice(5).map(v => (v < 0 ? -v : v));
    const a = (rowCells[0] * Math.PI) / 180;
    const aP = ((rowCells[0] - 90) * Math.PI) / 180;

    const x1 = (rowCells[1] + perpOffset * Math.cos(aP) * rowCells[4]) - (perpOffset * Math.cos(a) * rowCells[3]);
    const y1 = (rowCells[2] + perpOffset * Math.sin(aP) * rowCells[4]) - (perpOffset * Math.sin(a) * rowCells[3]);

    const t = 1000000;
    const difX = Math.cos(a + Math.PI * factor) * t;
    const difY = Math.sin(a + Math.PI * factor) * t;

    let x2 = x1 + difX;
    let y2 = y1 + difY;

    let end = false;

    const intersectBottom = checkLineIntersection(x1, y1, x2, y2, paddings.bottomLeft.x, paddings.bottomLeft.y, paddings.bottomRight.x, paddings.bottomRight.y);
    const intersectTop = checkLineIntersection(x1, y1, x2, y2, paddings.topLeft.x, paddings.topLeft.y, paddings.topRight.x, paddings.topRight.y);
    const intersectLeft = checkLineIntersection(x1, y1, x2, y2, paddings.bottomLeft.x, paddings.bottomLeft.y, paddings.topLeft.x, paddings.topLeft.y);
    const intersectRight = checkLineIntersection(x1, y1, x2, y2, paddings.bottomRight.x, paddings.bottomRight.y, paddings.topRight.x, paddings.topRight.y);

    const intersections = [intersectBottom, intersectTop, intersectLeft, intersectRight].filter(i => i.onLine2);
    if (intersections.length < 2) {
        end = true;
    }

    if (!end) {
        context.beginPath();
        context.moveTo(x1, -y1);
        context.lineDashOffset = 0;
        context.setLineDash(dasharray);
        if (factor > 0) {
            context.lineDashOffset = -dasharray[dasharray.length - 1];
            const backwards = [...dasharray].reverse();
            context.setLineDash([backwards[backwards.length - 1], backwards[0]]);
        }

        context.lineTo(x2, -y2);
        context.lineCap = "round";
        context.stroke();
        return true;
    }
}

function drawRowSequence(
    context: CanvasRenderingContext2D,
    paddings: Paddings,
    minVal: number,
    maxVal: number,
    row: PatternRow,
    offset: number,
    factor: number
): void {
    let drawIt = true;
    let index = factor;

    while (
        (factor === 0
            ? (drawIt || index < minVal) && index < maxVal
            : (drawIt || index > -minVal) && index > -maxVal) && row.cells.length > 1
    ) {
        drawIt = !!drawRow(context, paddings, row.cells, index, offset);
        index = factor === 0 ? index + 1 : index - 1;
    }
}

export function drawPattern(canvas: HTMLCanvasElement, pattern: PatternRow[], settings?: Partial<CanvasSettings>): HTMLCanvasElement {
    const mergedSettings: CanvasSettings = { ...DEFAULT_SETTINGS, ...settings };
    const context = canvas.getContext("2d")!;
    const paddings = calculatePaddings(mergedSettings);
    const drawRowSeq = (row: PatternRow, offset: number, factor: number) =>
        drawRowSequence(context, paddings, DRAW_MINIMUM, DRAW_MAXIMUM, row, offset, factor);

    setCanvasDimensions(canvas, mergedSettings);
    initialDrawingSettings(context, mergedSettings);

    pattern.forEach((row: PatternRow) => {
        drawRowSeq(row, 0, 0);
        drawRowSeq(row, 1, 0);
        drawRowSeq(row, 0, -1);
        drawRowSeq(row, 1, -1);
    });
    return canvas;
}

function parsePattern(raw: string): { cells: number[] }[] {
    const lines = raw.split('\n');
    return lines
        .map(line => {
            const rows = line.split(',').map(Number); // Convert strings to numbers
            if (typeof rows[0] === 'number' && !isNaN(rows[0])) {
                return { cells: rows };
            }
            return null;
        })
        .filter(Boolean) as { cells: number[] }[];
}

export async function fetchAndParsePattern(path: string): Promise<{ cells: number[] }[]> {
    const response = await fetch(path);
    const text = await response.text();
    return parsePattern(text);
}

export function loadPatFile(path: string, callback: (pattern: PatternRow[]) => void): void {
    fetchAndParsePattern(path).then(pattern => callback(pattern));
}