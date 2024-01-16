const nlp = text => {
    const toLower = x => x.toLowerCase();

    const output = {};

    const claimsKeywords = ["claims", "claim", "file", "accident", "incident", "incidents", "accidents"];

    if (claimsKeywords.some(keyword => toLower(text).includes(keyword))) {
        output.intent = "claims";
    } else {
        output.intent = "unknown";
    }
    return output;
}

export {
    nlp
}