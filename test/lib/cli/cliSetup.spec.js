import { expect } from "chai";
import CLISetup from "../../../lib/cli/cliSetup.js";

describe('CLISetup', () => {
  it('should be a nullary function', function() {
    expect(typeof CLISetup).to.equal('function');
    expect(CLISetup).to.have.lengthOf(1);
  })
});