import { expect } from "chai";
import CLIAuth from "../../../lib/cli/cliAuth.js";

describe('CLIAuth', () => {
  it('should be a nullary function', function() {
    expect(typeof CLIAuth).to.equal('function');
    expect(CLIAuth).to.have.lengthOf(0);
  })
});