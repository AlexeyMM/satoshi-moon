const Migrations = artifacts.require("Migrations");
const SatoshiMoon = artifacts.require("SatoshiMoon");

module.exports = function(deployer) {
  deployer.deploy(Migrations);
  deployer.deploy(SatoshiMoon);
};
