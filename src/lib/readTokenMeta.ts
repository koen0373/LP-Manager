import { Address } from 'viem';
import { publicClient } from './viemClient';
import { erc20DecimalsAbi, erc20NameAbi, erc20SymbolBytes32Abi, erc20SymbolStringAbi } from '../abi/erc20';

export async function readTokenMeta(token: Address) {
  // 1) symbol() string -> fallback naar bytes32 -> fallback naar name() -> fallback naar verkort adres
  let symbol = 'UNK';
  try {
    symbol = await publicClient.readContract({ 
      address: token, 
      abi: erc20SymbolStringAbi, 
      functionName: 'symbol' 
    });
  } catch {
    try {
      const raw = await publicClient.readContract({ 
        address: token, 
        abi: erc20SymbolBytes32Abi, 
        functionName: 'symbol' 
      });
      // Convert bytes32 to string manually
      symbol = Buffer.from((raw as string).slice(2), 'hex').toString('utf8').replace(/\0/g, '');
    } catch {
      try {
        symbol = await publicClient.readContract({ 
          address: token, 
          abi: erc20NameAbi, 
          functionName: 'name' 
        });
      } catch {
        symbol = `${token.slice(0,6)}…${token.slice(-4)}`;
      }
    }
  }

  // 2) decimals() met fallback 18
  let decimals = 18;
  try {
    const d = await publicClient.readContract({ 
      address: token, 
      abi: erc20DecimalsAbi, 
      functionName: 'decimals' 
    });
    decimals = Number(d);
  } catch { 
    // keep 18 as default
  }

  return { address: token, symbol, decimals };
}
