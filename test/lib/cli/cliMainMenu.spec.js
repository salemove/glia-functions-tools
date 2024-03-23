import { expect } from "chai";
import CLIMainMenu from "../../../lib/cli/cliMainMenu.js";

describe('CLIMainMenu', () => {
  it('should be a nullary function', function() {
    expect(typeof CLIMainMenu).to.equal('function');
    expect(CLIMainMenu).to.have.lengthOf(3);
  })
});