function sanitizeGeneratedCode(files) {
  const sanitized = { ...files };

  // Remove any potentially harmful scripts
  const removeHarmfulPatterns = (code) => {
    if (!code) return code;
    
    // Remove eval
    let cleaned = code.replace(/eval\s*\(/gi, "// eval removed ");
    
    // Remove document.cookie theft attempts
    cleaned = cleaned.replace(/document\.cookie/gi, "// document.cookie removed");
    
    // Remove localStorage token theft
    cleaned = cleaned.replace(/localStorage\.getItem\s*\(\s*['"]token['"]\s*\)/gi, "// localStorage token removed");
    
    // Remove fetch to external malicious sites (basic protection)
    cleaned = cleaned.replace(/fetch\s*\(\s*['"]https?:\/\/[^'"]+['"]/gi, "// external fetch removed");
    
    return cleaned;
  };

  if (sanitized.html) sanitized.html = removeHarmfulPatterns(sanitized.html);
  if (sanitized.css) sanitized.css = removeHarmfulPatterns(sanitized.css);
  if (sanitized.js) sanitized.js = removeHarmfulPatterns(sanitized.js);

  return sanitized;
}

module.exports = { sanitizeGeneratedCode };