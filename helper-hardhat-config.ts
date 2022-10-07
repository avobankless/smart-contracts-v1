export interface networkConfigItem {
  registrationKey?: string;
  superFluidHost?: string;
  superFluidResolver?: string;
  superFluidCFAv1?: string;
  superFluidIDAv1?: string;
  sDAI?: string;
  fDAI?: string;
  borrowerPools?: string;
}

export interface networkConfigInfo {
  [key: string]: networkConfigItem;
}

export const networkConfig: networkConfigInfo = {
  localhost: {},
  hardhat: {},
  goerli: {
    superFluidHost: '0x22ff293e14F1EC3A09B137e9e06084AFd63adDF9',
    superFluidResolver: '0x3710AB3fDE2B61736B8BB0CE845D6c61F667a78E',
    superFluidCFAv1: '0xEd6BcbF6907D4feEEe8a8875543249bEa9D308E8',
    sDAI: '0xb5191e4e65e658a154d5f2927962ce91d5e17a35',
    fDAI: '0x1714B9AF0BF10F9EdE7aEE00584B2B731437EdFA',
    borrowerPools: '0x605f6E5298F573Ae77d0a7626F25E64Ee44F5A42',
  },
  tenderly: {
    superFluidHost: '0x22ff293e14F1EC3A09B137e9e06084AFd63adDF9',
    superFluidResolver: '0x3710AB3fDE2B61736B8BB0CE845D6c61F667a78E',
    superFluidCFAv1: '0xEd6BcbF6907D4feEEe8a8875543249bEa9D308E8',
    superFluidIDAv1: '0xfDdcdac21D64B639546f3Ce2868C7EF06036990c',
    sDAI: '0xb5191e4e65e658a154d5f2927962ce91d5e17a35',
    fDAI: '0x1714B9AF0BF10F9EdE7aEE00584B2B731437EdFA',
    borrowerPools: '0x605f6E5298F573Ae77d0a7626F25E64Ee44F5A42',
  },
};

export const developmentChains = ['hardhat', 'localhost', 'ganache'];
