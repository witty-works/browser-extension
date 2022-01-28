import { Highlight } from "../shared/types";

export function drawHighlight(context: CanvasRenderingContext2D, roundedHighlight: Path2D, color: string, rect: DOMRect, elementRect: DOMRect) {
    let x = rect.left - elementRect.left;
    let y = rect.top - elementRect.top;
    let width = rect.width;
    let height = rect.height;
    let radius = 4;

    context.clearRect(x - 1, y - 1, width + 2, height + 2); // clear the previous rectangle (hover)

    roundedHighlight.moveTo(x + radius, y);
    roundedHighlight.arcTo(x + width, y, x + width, y + height, radius);
    roundedHighlight.arcTo(x + width, y + height, x, y + height, radius);
    roundedHighlight.arcTo(x, y + height, x, y, radius);
    roundedHighlight.arcTo(x, y, x + width, y, radius);

    context.fillStyle = color;
    context.fill(roundedHighlight)
}

export function redrawText(context: CanvasRenderingContext2D, element: HTMLElement, highlight: Highlight, rect: DOMRect, elementRect: DOMRect) {
    let x = rect.left - elementRect.left;
    let y = rect.top - elementRect.top + rect.height;

    const style = window.getComputedStyle(element);
    context.font = style.fontWeight + ' ' + style.fontSize + ' ' + style.fontFamily;

    let color = style.color;
    //adjusts font color for dark mode
    // if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    //     color = '#000000';
    // }
    context.fillStyle = color;
    context.textBaseline = "bottom";
    context.fillText(highlight.data.text, x, y);
}