import { buildSuggestion, buildResponseBody, buildResponse } from '../utils/gliaAi.js';
import { pipe } from '../utils/helpers.js';

const claimsWidget = text => pipe(
    buildSuggestion,
    buildResponseBody,
    buildResponse
)(text)

export default claimsWidget