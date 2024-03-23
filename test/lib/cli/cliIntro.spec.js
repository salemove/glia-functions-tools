import { expect } from "chai";
import CLIIntro from "../../../lib/cli/cliIntro.js";

describe('CLIIntro', () => {
  it('should be a unary function', function() {
    expect(typeof CLIIntro).to.equal('function');
    expect(CLIIntro).to.have.lengthOf(1);
  })
});