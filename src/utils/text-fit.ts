export function fitText(element: HTMLElement, text: string, maxFontSize = 1.2): void {
    if (!element) return;
    
    const containerWidth = element.offsetWidth - 20;
    if (containerWidth <= 0) return;
    
    element.textContent = text;
    element.style.fontSize = `${maxFontSize}rem`;
    element.style.lineHeight = '1.2';
    element.style.whiteSpace = 'nowrap';
    
    let fontSize = maxFontSize;
    while (element.scrollWidth > containerWidth && fontSize > 0.5) {
        fontSize -= 0.05;
        element.style.fontSize = `${fontSize}rem`;
    }
}

export function fitTextMultiline(element: HTMLElement, text: string, maxFontSize = 1.2, maxLines = 2): void {
    if (!element) return;
    
    const containerWidth = element.offsetWidth - 20;
    const containerHeight = element.offsetHeight - 10;
    if (containerWidth <= 0 || containerHeight <= 0) return;
    
    element.textContent = text;
    element.style.fontSize = `${maxFontSize}rem`;
    element.style.lineHeight = '1.2';
    element.style.whiteSpace = 'normal';
    
    let fontSize = maxFontSize;
    while ((element.scrollWidth > containerWidth || element.scrollHeight > containerHeight) && fontSize > 0.5) {
        fontSize -= 0.05;
        element.style.fontSize = `${fontSize}rem`;
    }
}
