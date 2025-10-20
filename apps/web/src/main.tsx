import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './styles.css';
import { createRoot } from 'react-dom/client';
import { ethers } from 'ethers';
import { AgreementInput, validateAgreementInput } from '@xao/shared/agreement';
import abi from './abi/PerformanceAgreementNFT.json';

const ENV_CONTRACT = import.meta.env.VITE_PERF_AGREEMENT_ADDRESS as string | undefined;
// Preserve the raw string so we can distinguish between missing and numeric '0'
const RAW_ENV_CHAIN_ID = import.meta.env.VITE_TARGET_CHAIN_ID as string | undefined;
const ENV_CHAIN_ID: number | undefined = RAW_ENV_CHAIN_ID && RAW_ENV_CHAIN_ID.trim() !== ''
  ? Number(RAW_ENV_CHAIN_ID)
  : undefined;
const HARDHAT_CHAIN_ID = 31337;
const HARDHAT_CHAIN_HEX = '0x' + HARDHAT_CHAIN_ID.toString(16); // 0x7a69

interface AgreementDraftForm {
  venueName: string;
  venueAddress: string;
  startTime: string; // ISO datetime-local string before conversion
  durationMinutes: number;
  artistSocialHandle: string;
  venueSocialHandle: string;
  artistWallet: string;
  venueWallet: string;
  paymentAmountUsdCents: number;
}

const defaultDraft: AgreementDraftForm = {
  venueName: '',
  venueAddress: '',
  startTime: new Date(Date.now() + 3600_000).toISOString().slice(0,16),
  durationMinutes: 120,
  artistSocialHandle: '',
  venueSocialHandle: '',
  artistWallet: '',
  venueWallet: '',
  paymentAmountUsdCents: 50000,
};

function App() {
  const [provider, setProvider] = useState<ethers.BrowserProvider>();
  const [signer, setSigner] = useState<ethers.Signer>();
  const [address, setAddress] = useState<string>('');
  const [draft, setDraft] = useState<AgreementDraftForm>(defaultDraft);
  const [errors, setErrors] = useState<string[]>([]);
  const [artistSig, setArtistSig] = useState<string>('');
  const [contractAddress, setContractAddress] = useState<string>(ENV_CONTRACT || '');
  const [networkChainId, setNetworkChainId] = useState<number>(0);
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [mintedTokenId, setMintedTokenId] = useState<string>('');
  const [ownedAgreements, setOwnedAgreements] = useState<Array<{tokenId:number; data:any}>>([]);

  const domain = useMemo(() => ({
    name: 'PerformanceAgreementNFT',
    version: '1',
    chainId: networkChainId,
    verifyingContract: contractAddress || ethers.ZeroAddress,
  }), [contractAddress, networkChainId]);

  const types = {
    AgreementInput: [
      { name: 'venueName', type: 'string' },
      { name: 'venueAddress', type: 'string' },
      { name: 'startTime', type: 'uint64' },
      { name: 'durationMinutes', type: 'uint32' },
      { name: 'artistSocialHandle', type: 'string' },
      { name: 'venueSocialHandle', type: 'string' },
      { name: 'artistWallet', type: 'address' },
      { name: 'venueWallet', type: 'address' },
      { name: 'paymentAmountUsdCents', type: 'uint256' },
    ],
  } as const;

  useEffect(() => {
    const eth = (window as any).ethereum;
    if (eth) {
      const p = new ethers.BrowserProvider(eth);
      setProvider(p);
      const chainHandler = (hexId: string) => {
        const dec = parseInt(hexId, 16);
        setNetworkChainId(dec);
        setStatusMsg(`Chain changed to ${dec}`);
      };
      const accountsHandler = (accounts: string[]) => {
        if (!accounts || !accounts.length) {
          setAddress('');
          return;
        }
        const newAddr = accounts[0];
        setAddress(newAddr);
        setDraft(d => {
          if (!artistSig) {
            if (!d.artistWallet || d.artistWallet === address) {
              return { ...d, artistWallet: newAddr };
            }
            return d;
          } else {
            if (!d.venueWallet || d.venueWallet.toLowerCase() === (address||'').toLowerCase() || d.venueWallet.toLowerCase() === d.artistWallet.toLowerCase()) {
              return { ...d, venueWallet: newAddr };
            }
            return d;
          }
        });
        setStatusMsg(`Account changed to ${newAddr.slice(0,6)}…${newAddr.slice(-4)}`);
      };
      eth.on?.('chainChanged', chainHandler);
      eth.on?.('accountsChanged', accountsHandler);
      return () => {
        eth.removeListener?.('chainChanged', chainHandler);
        eth.removeListener?.('accountsChanged', accountsHandler);
      };
    }
  }, [artistSig, address]);

  async function ensureHardhatNetwork() {
    if (!(window as any).ethereum) {
      setStatusMsg('No injected provider');
      return;
    }
    const ethereum = (window as any).ethereum;
    const currentHex = await ethereum.request({ method: 'eth_chainId' });
    if (currentHex === HARDHAT_CHAIN_HEX) {
      setStatusMsg('Already on Hardhat local network');
      return;
    }
    try {
      // try switch first
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: HARDHAT_CHAIN_HEX }]
      });
      setStatusMsg('Switched to Hardhat network');
    } catch (switchErr: any) {
      if (switchErr.code === 4902) {
        try {
          await ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: HARDHAT_CHAIN_HEX,
              chainName: 'Hardhat Local',
              nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
              rpcUrls: ['http://127.0.0.1:8545'],
              blockExplorerUrls: []
            }]
          });
          await ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: HARDHAT_CHAIN_HEX }]
          });
          setStatusMsg('Added and switched to Hardhat');
        } catch (addErr:any) {
          setStatusMsg('Add/switch failed: ' + addErr.message);
        }
      } else {
        setStatusMsg('Switch failed: ' + switchErr.message);
      }
    }
  }

  const connect = useCallback(async () => {
    if (!provider) return;
    await provider.send('eth_requestAccounts', []);
    const s = await provider.getSigner();
    setSigner(s);
    setAddress(await s.getAddress());
    const network = await provider.getNetwork();
    setNetworkChainId(Number(network.chainId));
    if (contractAddress) {
      try {
        const read = new ethers.Contract(contractAddress, abi as any, s);
        const ownerAddr = await s.getAddress();
        const tokenIds: number[] = await read.tokensOfOwner(ownerAddr);
        const items: Array<{tokenId:number; data:any}> = [];
        for (const tid of tokenIds) {
          try {
            const uri: string = await read.tokenURI(tid);
            const json = parseDataUriJson(uri);
            items.push({ tokenId: tid, data: json });
          } catch {}
        }
        setOwnedAgreements(items);
      } catch (e:any) {
        setStatusMsg('Load agreements failed: ' + e.message);
      }
    }
  }, [provider, domain]);

  function update<K extends keyof AgreementDraftForm>(key: K, value: AgreementDraftForm[K]) {
    setDraft((d: AgreementDraftForm) => ({ ...d, [key]: value }));
  }

  async function artistSign() {
    if (!signer) { setStatusMsg('Connect wallet first'); return; }
    if (!contractAddress) { setStatusMsg('Missing contract address'); return; }
    if (ENV_CHAIN_ID && networkChainId && ENV_CHAIN_ID !== networkChainId) {
      setStatusMsg(`Network mismatch. Expected ${ENV_CHAIN_ID}, got ${networkChainId}`);
      return;
    }
    try {
      const startTs = Math.floor(new Date(draft.startTime).getTime() / 1000);
      const value: AgreementInput = {
        venueName: draft.venueName,
        venueAddress: draft.venueAddress,
        startTime: startTs,
        durationMinutes: draft.durationMinutes,
        artistSocialHandle: draft.artistSocialHandle,
        venueSocialHandle: draft.venueSocialHandle,
        artistWallet: draft.artistWallet,
        venueWallet: draft.venueWallet,
        paymentAmountUsdCents: draft.paymentAmountUsdCents,
      };
      const validation = validateAgreementInput(value);
      if (validation.length) {
        setErrors(validation);
        setStatusMsg('Validation errors present');
        return;
      }
      const sig = await (signer as any).signTypedData(domain, types, value);
      setArtistSig(sig);
      setStatusMsg('Artist signature captured');
      update('artistWallet', address as any);
      setErrors([]);

      // Auto-submit if artist is also venue (same wallet) and venue wallet matches signer address
      if (value.venueWallet && value.venueWallet.toLowerCase() === address.toLowerCase()) {
        setStatusMsg('Artist signature captured; submitting on-chain (artist == venue)…');
        await autoSubmitAfterArtist(sig, value);
      }
    } catch (e:any) {
      setStatusMsg('Signature failed: ' + e.message);
    }
  }

  async function autoSubmitAfterArtist(sig: string, signedValue: AgreementInput) {
    // Re-run minimal validation in case of race conditions
    const vErrs = validateAgreementInput(signedValue);
    if (vErrs.length) { setErrors(vErrs); setStatusMsg('Auto-submit aborted: validation errors'); return; }
    if (!provider) { setStatusMsg('No provider for auto-submit'); return; }
    try {
      const venueSigner = signer;
      if (!venueSigner) { setStatusMsg('Connect wallet to submit'); return; }
      // Ensure venueWallet consistency
      if (signedValue.venueWallet.toLowerCase() !== address.toLowerCase()) {
        setStatusMsg('Auto-submit skipped (current account not venue)');
        return;
      }
      const contract = new ethers.Contract(contractAddress, abi as any, venueSigner);
      const tx = await contract.createAgreementWithArtistSig(signedValue, sig);
      setStatusMsg('Submitting transaction (auto)…');
      const receipt = await tx.wait();
      const evtLog = receipt.logs.find((l: any) => {
        try { const pl = contract.interface.parseLog(l); return pl && pl.name === 'AgreementSignedAndMinted'; } catch { return false; }
      });
      if (evtLog) {
        let parsedEvent: any = null; try { parsedEvent = contract.interface.parseLog(evtLog); } catch {}
        if (parsedEvent && parsedEvent.args?.tokenId) {
          const tokenIdStr = parsedEvent.args.tokenId.toString();
            setMintedTokenId(tokenIdStr);
            setStatusMsg('Minted token #' + tokenIdStr + ' (auto-submit)');
            try {
              const read = new ethers.Contract(contractAddress, abi as any, venueSigner);
              const tokenIds: number[] = await read.tokensOfOwner(signedValue.artistWallet);
              const items: Array<{tokenId:number; data:any}> = [];
              for (const tid of tokenIds) {
                try { const uri: string = await read.tokenURI(tid); const json = parseDataUriJson(uri); items.push({ tokenId: tid, data: json }); } catch {}
              }
              setOwnedAgreements(items);
            } catch {}
        }
      }
    } catch (e:any) {
      setStatusMsg('Auto-submit failed: ' + e.message);
    }
  }

  async function venueSubmit() {
    if (!provider) return;
    if (!artistSig) { setStatusMsg('Need artist signature first'); return; }
    try {
      const venueSigner = signer;
      if (!venueSigner) { setStatusMsg('Connect wallet'); return; }
      // Ensure venue wallet field matches connected wallet before sending tx
      if (!draft.venueWallet || draft.venueWallet.toLowerCase() !== address.toLowerCase()) {
        setDraft(d => ({ ...d, venueWallet: address }));
        setStatusMsg('Venue wallet field updated to connected account. Review & click submit again.');
        return;
      }
  const contract = new ethers.Contract(contractAddress, abi as any, venueSigner);
      const startTs = Math.floor(new Date(draft.startTime).getTime() / 1000);
      const input: AgreementInput = {
        venueName: draft.venueName,
        venueAddress: draft.venueAddress,
        startTime: startTs,
        durationMinutes: draft.durationMinutes,
        artistSocialHandle: draft.artistSocialHandle,
        venueSocialHandle: draft.venueSocialHandle,
        artistWallet: draft.artistWallet,
        venueWallet: draft.venueWallet,
        paymentAmountUsdCents: draft.paymentAmountUsdCents,
      };
      const validation = validateAgreementInput(input);
      if (validation.length) {
        setErrors(validation);
        setStatusMsg('Validation errors present');
        return;
      }
      const tx = await contract.createAgreementWithArtistSig(input, artistSig);
      setStatusMsg('Submitting transaction...');
      const receipt = await tx.wait();
      const evtLog = receipt.logs.find((l: any) => {
        try {
          const pl = contract.interface.parseLog(l);
          return pl && pl.name === 'AgreementSignedAndMinted';
        } catch { return false; }
      });
      if (evtLog) {
        let parsedEvent: any = null;
        try { parsedEvent = contract.interface.parseLog(evtLog); } catch {}
        if (parsedEvent && parsedEvent.args?.tokenId) {
          const tokenIdStr = parsedEvent.args.tokenId.toString();
          setMintedTokenId(tokenIdStr);
          setStatusMsg('Minted token #' + tokenIdStr);
          // refresh owned agreements (artist is recipient)
          try {
            const read = new ethers.Contract(contractAddress, abi as any, venueSigner);
            const tokenIds: number[] = await read.tokensOfOwner(draft.artistWallet);
            const items: Array<{tokenId:number; data:any}> = [];
            for (const tid of tokenIds) {
              try {
                const uri: string = await read.tokenURI(tid);
                const json = parseDataUriJson(uri);
                items.push({ tokenId: tid, data: json });
              } catch {}
            }
            setOwnedAgreements(items);
          } catch {}
        } else {
          setStatusMsg('Transaction mined, event parse incomplete');
        }
      } else {
        setStatusMsg('Transaction mined, event not found');
      }
    } catch (e:any) {
      setStatusMsg('Venue submit failed: ' + e.message);
    }
  }

  return (
    <div>
      <header className="app-header">
        <h1>Performance Agreement NFT</h1>
        <p>Draft, sign (EIP-712) and mint agreement between artist & venue.</p>
      </header>
      <div className="section-fields">
      <div className="card">
        <h3>1. Connect Wallet</h3>
        <p>Both artist and venue can connect in turn to sign & submit.</p>
        <button onClick={connect} disabled={!provider}>Connect</button>
        <div style={{ marginTop: '.5rem' }}>Connected: {address || '—'}</div>
      </div>
      <div className="card">
        <h3>2. Draft Agreement</h3>
        {ENV_CONTRACT ? (
          <div style={{fontSize:'.75rem', marginBottom:'0.75rem'}}>
            <div style={{display:'flex', alignItems:'center', gap:'.5rem'}}>
              <span style={{opacity:.7}}>Contract:</span>
              <code style={{fontSize:'.7rem', background:'#1e242b', padding:'.25rem .4rem', borderRadius:'4px'}}>{contractAddress}</code>
              <button type="button" style={{fontSize:'.6rem', padding:'.25rem .4rem'}} onClick={() => {
                navigator.clipboard.writeText(contractAddress);
                setStatusMsg('Contract address copied');
              }}>Copy</button>
            </div>
            <small style={{color:'#888'}}>From environment (VITE_PERF_AGREEMENT_ADDRESS)</small>
          </div>
        ) : (
          <label>Contract Address (deployed PerformanceAgreementNFT)
            <input value={contractAddress} onChange={e => setContractAddress(e.target.value.trim())} placeholder="0x..." />
          </label>
        )}
        {ENV_CHAIN_ID !== undefined ? (
          <div style={{fontSize:'0.8rem'}}>
            Env Chain ID: {ENV_CHAIN_ID} | Connected: {networkChainId || '—'} {ENV_CHAIN_ID && networkChainId && ENV_CHAIN_ID !== networkChainId && (<span style={{color:'#d33'}}> (mismatch)</span>)}
            {ENV_CHAIN_ID && networkChainId && ENV_CHAIN_ID !== networkChainId && (
              <div style={{marginTop:'.4rem'}}>
                <button onClick={async () => {
                  try {
                    await (window as any).ethereum.request({
                      method: 'wallet_switchEthereumChain',
                      params: [{ chainId: '0x' + ENV_CHAIN_ID.toString(16) }]
                    });
                    setStatusMsg('Requested network switch');
                  } catch (e:any) {
                    if (e.code === 4902) {
                      setStatusMsg('Chain not added in wallet. Add network manually.');
                    } else {
                      setStatusMsg('Switch failed: ' + e.message);
                    }
                  }
                }}>Switch Network</button>
              </div>
            )}
            {networkChainId !== HARDHAT_CHAIN_ID && (
              <div style={{marginTop:'.4rem'}}>
                <button onClick={ensureHardhatNetwork}>Switch to Hardhat (31337)</button>
              </div>
            )}
          </div>
        ) : (
          <div style={{fontSize:'0.8rem'}}>No ENV chain id provided</div>
        )}
        {contractAddress && networkChainId !== HARDHAT_CHAIN_ID && contractAddress.toLowerCase() === '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'.toLowerCase() && (
          <div style={{color:'#d33', fontSize:'0.75rem', marginTop:'.5rem'}}>
            This looks like the default Hardhat local deployment address but you're not on chain 31337.
          </div>
        )}
        <label>Venue Name
          <input value={draft.venueName} onChange={e => update('venueName', e.target.value)} />
        </label>
        <label>Venue Address (physical)
          <input value={draft.venueAddress} onChange={e => update('venueAddress', e.target.value)} />
        </label>
        <label>Start Time
          <input type="datetime-local" value={draft.startTime} onChange={e => update('startTime', e.target.value)} />
        </label>
        <div className="pair-row">
          <label>Duration Minutes
            <input type="number" value={draft.durationMinutes} onChange={e => update('durationMinutes', Number(e.target.value))} />
          </label>
          <label>Payment USD (e.g. 500.00)
            <input type="number" value={draft.paymentAmountUsdCents/100} onChange={e => update('paymentAmountUsdCents', Math.round(Number(e.target.value) * 100))} />
          </label>
        </div>
        <div className="pair-row">
          <label>Artist Social Handle
            <input value={draft.artistSocialHandle} onChange={e => update('artistSocialHandle', e.target.value)} />
          </label>
          <label>Venue Social Handle
            <input value={draft.venueSocialHandle} onChange={e => update('venueSocialHandle', e.target.value)} />
          </label>
        </div>
        <div className="pair-row">
          <label>Artist Wallet
            <input value={draft.artistWallet} onChange={e => update('artistWallet', e.target.value)} placeholder="0xArtist" />
          </label>
          <label>Venue Wallet
            <input value={draft.venueWallet} onChange={e => update('venueWallet', e.target.value)} placeholder="0xVenue" />
          </label>
        </div>
      </div>
      <div className="card">
        <h3>3. Artist Signature</h3>
        <p>Artist connects wallet, fills their address above, then signs typed data.</p>
  <button onClick={artistSign} disabled={!!(!signer || !draft.artistWallet || !contractAddress || (ENV_CHAIN_ID && networkChainId && ENV_CHAIN_ID !== networkChainId))}>Sign Agreement</button>
        {artistSig && <div className="signature">{artistSig}</div>}
      </div>
      <div className="card">
        <h3>4. Venue Submission</h3>
        <p>Venue connects wallet and submits signed agreement to mint NFT to artist.</p>
  <button onClick={venueSubmit} disabled={!!(!artistSig || !signer || (ENV_CHAIN_ID && networkChainId && ENV_CHAIN_ID !== networkChainId))}>Submit & Mint</button>
        {mintedTokenId && <div className="status">Minted Token ID: {mintedTokenId}</div>}
      </div>
      <div className="card status-card">
        <h3>Status</h3>
        <p>{statusMsg}</p>
        {!!errors.length && (
          <ul className="error-list">
            {errors.map(e => <li key={e}>{e}</li>)}
          </ul>
        )}
      </div>
      <div className="card">
        <h3>Your Agreements</h3>
        {ownedAgreements.length === 0 && <p style={{fontSize:'0.75rem', color:'#7e8b99'}}>No agreements owned.</p>}
        {ownedAgreements.length > 0 && (
          <div className="pair-row" style={{gridTemplateColumns:'repeat(auto-fill,minmax(250px,1fr))'}}>
            {ownedAgreements.map(a => (
              <div key={a.tokenId} style={{background:'#1e242b', padding:'.75rem .8rem', border:'1px solid #2c3440', borderRadius:'10px'}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'.4rem'}}>
                  <strong style={{fontSize:'.8rem'}}>Token #{a.tokenId}</strong>
                  <span style={{fontSize:'.6rem', padding:'.2rem .45rem', borderRadius:'6px', background:statusColor(a.data.status)}}>{a.data.status}</span>
                </div>
                <div style={{fontSize:'.65rem', lineHeight:'1.2'}}>
                  <div><b>Venue:</b> {truncate(a.data.venueName, 22)}</div>
                  <div><b>Start:</b> {a.data.startTime ? new Date(Number(a.data.startTime)*1000).toLocaleString() : '—'}</div>
                  <div><b>Duration:</b> {a.data.durationMinutes}m</div>
                  <div><b>Payment:</b> {a.data.paymentAmountUsdCents ? '$'+(Number(a.data.paymentAmountUsdCents)/100).toFixed(2) : '—'}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);

// Helper functions appended (kept outside component scope intentionally)
function parseDataUriJson(dataUri: string): any {
  const prefix = 'data:application/json;base64,';
  if (!dataUri || !dataUri.startsWith(prefix)) return {};
  try {
    const b64 = dataUri.slice(prefix.length);
    const jsonStr = atob(b64);
    return JSON.parse(jsonStr);
  } catch {
    return {};
  }
}

function statusColor(status?: string): string {
  switch (status) {
    case 'Scheduled': return '#2563eb33';
    case 'Completed': return '#05966933';
    case 'Disputed': return '#dc262633';
    case 'Resolved': return '#7c3aed33';
    default: return '#37415133';
  }
}

function truncate(str: string | undefined, max: number): string {
  if (!str) return '';
  return str.length <= max ? str : str.slice(0, max - 1) + '…';
}
