import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './styles.css';
import { createRoot } from 'react-dom/client';
import { ethers } from 'ethers';
import { AgreementInput, validateAgreementInput } from '@xao/shared/agreement';
import abi from './abi/PerformanceAgreementNFT.json';

// Hard-coded deployed PerformanceAgreementNFT contract address (requested)
const CONTRACT_ADDRESS = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0';
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

// Shared hook for provider + signer
function useEthers() {
  const [provider, setProvider] = useState<ethers.BrowserProvider>();
  const [signer, setSigner] = useState<ethers.Signer>();
  const [address, setAddress] = useState<string>('');
  const [networkChainId, setNetworkChainId] = useState<number>(0);
  useEffect(() => {
    const eth = (window as any).ethereum;
    if (!eth) return;
    const p = new ethers.BrowserProvider(eth);
    setProvider(p);
    const chainHandler = (hexId: string) => { setNetworkChainId(parseInt(hexId,16)); };
    const accountsHandler = (accounts: string[]) => { setAddress(accounts?.[0] || ''); };
    eth.on?.('chainChanged', chainHandler);
    eth.on?.('accountsChanged', accountsHandler);
    return () => { eth.removeListener?.('chainChanged', chainHandler); eth.removeListener?.('accountsChanged', accountsHandler); };
  }, []);
  const connect = useCallback(async () => {
    if (!provider) return;
    await provider.send('eth_requestAccounts', []);
    const s = await provider.getSigner();
    setSigner(s);
    setAddress(await s.getAddress());
    const net = await provider.getNetwork();
    setNetworkChainId(Number(net.chainId));
  }, [provider]);
  return { provider, signer, address, networkChainId, connect };
}

// Venue page: phase 1 creation
function VenuePage({ contractAddress }: { contractAddress: string }) {
  const { provider, signer, address, networkChainId, connect } = useEthers();
  const [draft, setDraft] = useState<AgreementDraftForm>(defaultDraft);
  const [statusMsg, setStatusMsg] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [createdTokenId, setCreatedTokenId] = useState<string>('');
  const [owned, setOwned] = useState<Array<{tokenId:number; data:any}>>([]);

  useEffect(() => { setDraft(d => ({ ...d, venueWallet: address || d.venueWallet })); }, [address]);

  async function refreshOwned() {
    if (!signer || !contractAddress) return;
    try {
      const c = new ethers.Contract(contractAddress, abi as any, signer);
      const ids: number[] = await c.tokensOfOwner(address);
      const list: Array<{tokenId:number; data:any}> = [];
      for (const id of ids) { try { const uri = await c.tokenURI(id); list.push({ tokenId: id, data: parseDataUriJson(uri) }); } catch {} }
      setOwned(list);
    } catch (e:any) { setStatusMsg('Owned refresh failed: ' + e.message); }
  }

  async function createVenue() {
    if (!signer) { setStatusMsg('Connect wallet first'); return; }
    if (!draft.artistWallet) { setStatusMsg('Artist wallet required'); return; }
    const startTs = Math.floor(new Date(draft.startTime).getTime() / 1000);
    const input: AgreementInput = {
      venueName: draft.venueName,
      venueAddress: draft.venueAddress,
      startTime: startTs,
      durationMinutes: draft.durationMinutes,
      artistSocialHandle: draft.artistSocialHandle,
      venueSocialHandle: draft.venueSocialHandle,
      artistWallet: draft.artistWallet,
      venueWallet: address,
      paymentAmountUsdCents: draft.paymentAmountUsdCents,
    };
    const vErrs = validateAgreementInput(input);
    if (vErrs.length) { setErrors(vErrs); setStatusMsg('Validation errors'); return; }
    try {
      const c = new ethers.Contract(contractAddress, abi as any, signer);
      const tx = await c.createVenueAgreement(input);
      setStatusMsg('Venue agreement tx submitted');
      const receipt = await tx.wait();
      const log = receipt.logs.find((l:any) => { try { const pl = c.interface.parseLog(l); return pl?.name === 'VenueAgreementCreated'; } catch { return false; } });
      if (log) {
        const ev = c.interface.parseLog(log);
        if (ev && ev.args?.venueTokenId) {
          const tid = ev.args.venueTokenId.toString();
          setCreatedTokenId(tid);
          setStatusMsg('Venue agreement minted #' + tid);
          refreshOwned();
        }
      }
    } catch (e:any) { setStatusMsg('Create venue failed: ' + e.message); }
  }

  function update<K extends keyof AgreementDraftForm>(key: K, value: AgreementDraftForm[K]) { setDraft(d => ({ ...d, [key]: value })); }

  return (
    <div>
      <h2>Venue Portal (Phase 1)</h2>
      <button onClick={connect} disabled={!provider}>Connect Venue Wallet</button> <span style={{opacity:.7}}>{address || '—'}</span>
      <div style={{marginTop:'1rem'}}>
        <label>Artist Wallet<input value={draft.artistWallet} onChange={e=>update('artistWallet', e.target.value)} placeholder='0xArtist'/></label>
        <label>Venue Name<input value={draft.venueName} onChange={e=>update('venueName', e.target.value)} /></label>
        <label>Venue Address<input value={draft.venueAddress} onChange={e=>update('venueAddress', e.target.value)} /></label>
        <label>Start Time<input type='datetime-local' value={draft.startTime} onChange={e=>update('startTime', e.target.value)} /></label>
        <label>Duration (minutes)<input type='number' value={draft.durationMinutes} onChange={e=>update('durationMinutes', Number(e.target.value))} /></label>
        <label>Artist Handle<input value={draft.artistSocialHandle} onChange={e=>update('artistSocialHandle', e.target.value)} /></label>
        <label>Venue Handle<input value={draft.venueSocialHandle} onChange={e=>update('venueSocialHandle', e.target.value)} /></label>
        <label>Payment (USD cents)<input type='number' value={draft.paymentAmountUsdCents} onChange={e=>update('paymentAmountUsdCents', Number(e.target.value))} /></label>
        <button onClick={createVenue}>Create Venue Agreement</button>
      </div>
      {createdTokenId && <div className='status-card'>Created venue token #{createdTokenId}. Share this id with artist for finalization.</div>}
      {errors.length > 0 && <ul style={{color:'#d44'}}>{errors.map(er => <li key={er}>{er}</li>)}</ul>}
      <h3>Your Agreements</h3>
      <button onClick={refreshOwned}>Refresh</button>
      <ul>{owned.map(o => <li key={o.tokenId}>#{o.tokenId} {o.data?.venueName} status {o.data?.status}</li>)}</ul>
      <div style={{marginTop:'1rem', fontSize:'.8rem', opacity:.8}}>Chain ID: {networkChainId}</div>
      <div style={{marginTop:'.5rem'}}>{statusMsg}</div>
    </div>
  );
}

// Artist page: phase 2 finalize
function ArtistPage({ contractAddress }: { contractAddress: string }) {
  const { provider, signer, address, connect } = useEthers();
  const [venueTokenIdInput, setVenueTokenIdInput] = useState<string>('');
  const [statusMsg, setStatusMsg] = useState('');
  const [finalizedTokenId, setFinalizedTokenId] = useState<string>('');
  const [venueAgreement, setVenueAgreement] = useState<any>(null);
  const [artistSig, setArtistSig] = useState<string>('');
  const [ownedArtistTokens, setOwnedArtistTokens] = useState<Array<{tokenId:number; data:any}>>([]);

  async function refreshOwnedArtist() {
    if (!signer || !address) return;
    try {
      const c = new ethers.Contract(contractAddress, abi as any, signer);
      const ids: number[] = await c.tokensOfOwner(address);
      const list: Array<{tokenId:number; data:any}> = [];
      for (const id of ids) {
        try { const uri = await c.tokenURI(id); list.push({ tokenId: id, data: parseDataUriJson(uri) }); } catch {}
      }
      setOwnedArtistTokens(list);
    } catch (e:any) { setStatusMsg('Owned load failed: ' + e.message); }
  }

  useEffect(() => { if (address && signer) { refreshOwnedArtist(); } }, [address, signer]);

  async function loadVenueAgreement() {
    if (!signer || !venueTokenIdInput) return;
    try {
      const c = new ethers.Contract(contractAddress, abi as any, signer);
      const ag = await c.getAgreement(Number(venueTokenIdInput));
      setVenueAgreement(ag);
      setStatusMsg('Loaded venue agreement');
    } catch (e:any) { setStatusMsg('Load failed: ' + e.message); }
  }

  // Sign finalize typed data
  async function signFinalize() {
    if (!signer) { setStatusMsg('Connect wallet first'); return; }
    if (!venueAgreement) { setStatusMsg('Load venue agreement first'); return; }
    if (address.toLowerCase() !== venueAgreement.artistWallet.toLowerCase()) { setStatusMsg('Connected wallet not artist'); return; }
    try {
      const domain = { name: 'PerformanceAgreementNFT', version: '1', chainId: await signer.provider!.getNetwork().then(n=>Number(n.chainId)), verifyingContract: contractAddress };
      const types = { ArtistFinalize: [ { name: 'venueTokenId', type: 'uint256' }, { name: 'artistWallet', type: 'address' } ] } as const;
      const value = { venueTokenId: Number(venueTokenIdInput), artistWallet: address } as any;
      const sig = await (signer as any).signTypedData(domain, types, value);
      setArtistSig(sig);
      setStatusMsg('Artist finalize signature captured');
    } catch (e:any) { setStatusMsg('Sign finalize failed: ' + e.message); }
  }

  async function finalizeMint() {
    if (!signer) { setStatusMsg('Connect first'); return; }
    if (!artistSig) { setStatusMsg('Need artist signature'); return; }
    try {
      const c = new ethers.Contract(contractAddress, abi as any, signer);
      const tx = await c.artistFinalizeAndMint(Number(venueTokenIdInput), artistSig);
      setStatusMsg('Finalize tx sent');
      const receipt = await tx.wait();
      const log = receipt.logs.find((l:any) => { try { const pl = c.interface.parseLog(l); return pl?.name === 'ArtistAgreementFinalized'; } catch { return false; } });
      if (log) {
        const ev = c.interface.parseLog(log);
        if (ev && ev.args?.artistTokenId) {
          const id = ev.args.artistTokenId.toString();
          setFinalizedTokenId(id);
          setStatusMsg('Artist token minted #' + id);
        }
      }
    } catch (e:any) { setStatusMsg('Finalize failed: ' + e.message); }
  }

  return (
    <div>
      <h2>Artist Portal (Phase 2)</h2>
      <button onClick={connect} disabled={!provider}>Connect Artist Wallet</button> <span style={{opacity:.7}}>{address || '—'}</span>
      <div style={{marginTop:'1rem'}}>
        <label>Venue Token ID<input value={venueTokenIdInput} onChange={e=>setVenueTokenIdInput(e.target.value)} placeholder='e.g. 1' /></label>
        <button onClick={loadVenueAgreement}>Load Venue Agreement</button>
        {venueAgreement && (
          <div className='status-card'>Venue Agreement Loaded<br/>Venue: {venueAgreement.venueName}<br/>Status code: {venueAgreement.status}</div>
        )}
        <button onClick={signFinalize} disabled={!venueAgreement}>Sign Finalization</button>
        <button onClick={finalizeMint} disabled={!artistSig}>Finalize & Mint Artist NFT</button>
      </div>
      {finalizedTokenId && <div className='status-card'>Finalized artist token #{finalizedTokenId}</div>}
      <div style={{marginTop:'1.25rem'}}>
        <h3>Your Agreement NFTs</h3>
        <button onClick={refreshOwnedArtist} disabled={!signer} style={{marginBottom:'.5rem'}}>Refresh</button>
        {ownedArtistTokens.length === 0 && <div style={{fontSize:'.7rem', opacity:.6}}>No agreement NFTs owned.</div>}
        {ownedArtistTokens.length > 0 && (
          <div style={{display:'grid', gap:'.6rem', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))'}}>
            {ownedArtistTokens.map(t => (
              <div key={t.tokenId} style={{background:'#1e242b', border:'1px solid #2c3440', borderRadius:'8px', padding:'.55rem .6rem'}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'.35rem'}}>
                  <strong style={{fontSize:'.75rem'}}>Token #{t.tokenId}</strong>
                  <span style={{fontSize:'.55rem', padding:'.2rem .4rem', borderRadius:'4px', background:statusColor(t.data.status)}}>{t.data.status}</span>
                </div>
                <div style={{fontSize:'.6rem', lineHeight:'1.15'}}>
                  <div><b>Venue:</b> {truncate(t.data.venueName, 24)}</div>
                  <div><b>Start:</b> {t.data.startTime ? new Date(Number(t.data.startTime)*1000).toLocaleDateString() : '—'}</div>
                  <div><b>Pay:</b> {t.data.paymentAmountUsdCents ? '$'+(Number(t.data.paymentAmountUsdCents)/100).toFixed(2) : '—'}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{marginTop:'0.75rem'}}>{statusMsg}</div>
    </div>
  );
}

function App() {
  const contractAddress = CONTRACT_ADDRESS; // fixed address
  const [route, setRoute] = useState<string>(() => (typeof window !== 'undefined' ? window.location.hash.replace('#','') : '') || '/venue');
  useEffect(() => {
    const handler = () => setRoute((window.location.hash.replace('#','')) || '/venue');
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  return (
    <div>
      <header className='app-header'>
        <h1>Performance Agreement NFT</h1>
        <nav style={{display:'flex', gap:'1rem', fontSize:'.85rem'}}>
          <a href='#/venue'>Venue Portal</a>
          <a href='#/artist'>Artist Portal</a>
        </nav>
      </header>
      <div className='section-fields'>
        {route.startsWith('/artist') ? <ArtistPage contractAddress={contractAddress} /> : <VenuePage contractAddress={contractAddress} />}
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
