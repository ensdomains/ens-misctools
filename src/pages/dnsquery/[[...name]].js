import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { memo } from 'react';
import styled from 'styled-components';
import { useDebounce } from 'usehooks-ts';
import {
  Button,
  Card,
  CheckSVG,
  CrossSVG,
  Input,
  LinkSVG,
  Select,
  Skeleton,
  SkeletonGroup,
  Spinner,
} from '@ensdomains/thorin';
import {
  useAccount,
  useSwitchChain,
  useEnsAddress,
  useEnsResolver,
} from 'wagmi';

import { verify, utils } from 'dnssec-debugger-exp/dist/index.esm';

// Network configurations
const NETWORKS = [
  {
    id: 1,
    name: 'mainnet',
    label: 'Mainnet',
  },
  {
    id: 11155111,
    name: 'sepolia',
    label: 'Sepolia',
  },
];

const Form = memo(styled.form`
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 1rem;
`);

const Debugger = memo(styled.div`
  overflow: auto;
  height: 30vh;
  font-weight: 400;
  line-height: 2rem;
  word-wrap: break-word;
  padding: 0 20px;
`);

const CodeBlock = memo(styled.pre`
  font-family: monospace;
  margin: 10px 0;
  font-size: 10pt;
`);

const EOF = memo(styled.div``);

const LogDownloader = memo(styled.div`
  float: right;
  color: rgb(56, 136, 255);
  cursor: pointer;
  text-align: right;
  width: fit-content;
  font-size: 10pt;
  margin: 10px 15px 15px 0;
`);

const SpinnerWrapper = memo(styled.div`
  display: ${(props) => (props.hidden ? 'none' : 'inline')};
  margin: 0 5px;
  div {
    display: inline-block;
  }
`);

const IconWrapper = memo(styled.div`
  display: inline-block;
  margin: 0 5px;
  path {
    fill: ${(props) => props.color || '#000'};
  }
`);

const DebugTitle = memo(styled.summary`
  visibility: ${(props) => (props.enabled ? 'visible' : 'hidden')};
  font-size: 12pt;
  font-weight: bold;
  margin: 15px 0;
  cursor: pointer;
`);

const DebugTitleRaw = memo(styled.div`
  visibility: ${(props) => (props.enabled ? 'visible' : 'hidden')};
  font-size: 12pt;
  font-weight: bold;
  margin: 15px 0 15px 24px;
  cursor: pointer;
`);

const DebugDetails = memo(styled.details`
  margin-left: 10px;
`);

// Helper functions
function extractENSRecord(record) {
  const asciiContent = utils.hexToAscii(record).split('\t').join();
  const parts = asciiContent.split(',');
  const txtRecords = parts.filter((part) => part.includes('ENS1'));
  return txtRecords.pop()?.split('ENS1')[1];
}

function isDomain(domain) {
  const domainLDs = domain.split('.');
  return domainLDs.length > 1 && (domainLDs.at(-1) || []).length > 1;
}

const canUseDOM = typeof window !== 'undefined';
const useIsomorphicLayoutEffect = canUseDOM ? useLayoutEffect : useEffect;

export default function Page() {
  const [name, setName] = useState('');
  const [status, setStatus] = useState({
    isLoading: false,
    isLibLoading: false,
    isContractLoading: false,
    isPrefixLoading: false,
    isAddressLoading: false,
    isLibSuccess: false,
    isContractSuccess: false,
    libError: '',
    contractError: '',
    queryError: '',
  });
  const [result, setResult] = useState({});
  const [logs, setLogs] = useState({ libLogs: [], contractLogs: [] });
  const debouncedInput = useDebounce(name, 200);
  const refLibEOF = useRef(null);
  const refContractEOF = useRef(null);
  const resultCount = Object.keys(result).length;

  const { chain } = useAccount();
  const { switchNetwork } = useSwitchChain();

  const { data: ensAddress } = useEnsAddress({
    name: debouncedInput,
    enabled: isDomain(debouncedInput),
  });

  const { data: ensResolver } = useEnsResolver({
    name: debouncedInput,
    enabled: isDomain(debouncedInput),
  });

  const address =
    name !== debouncedInput
      ? undefined
      : isDomain(debouncedInput)
      ? debouncedInput
      : undefined;

  function updateStatus(args) {
    setStatus((prev) => ({ ...prev, ...args }));
  }

  async function queryName(_networkId, dnsName) {
    utils.logQueue.reset();
    resetStates();
    await new Promise((r) => setTimeout(r, 1000));

    try {
      const proveResult = await verify(dnsName, 'TXT');
      const { isValid, reason } = proveResult;
      if (!isValid) {
        updateStatus({
          isContractLoading: false,
          contractError: reason || '',
          isLoading: false,
        });
        setLogs((prev) => ({
          ...prev,
          contractLogs: [...prev.contractLogs, reason || ''],
        }));
        return;
      }
      updateStatus({
        isContractLoading: false,
        isContractSuccess: true,
      });

      updateStatus({ isPrefixLoading: true });
      const rawData = proveResult.result?.rawData;
      setResult((prev) => ({
        ...prev,
        txt: rawData && extractENSRecord(rawData),
      }));
      updateStatus({
        isPrefixLoading: false,
        isAddressLoading: true,
      });

      // ENS address resolution is handled by the useEnsAddress hook
      setResult((prev) => ({
        ...prev,
        address: ensAddress,
      }));
    } catch (error) {
      reportError(error);
    }

    updateStatus({
      isAddressLoading: false,
      isLoading: false,
    });
  }

  function resetStates() {
    setLogs({ libLogs: [], contractLogs: [] });
    setStatus({
      isLoading: true,
      isLibLoading: false,
      isContractLoading: false,
      isPrefixLoading: false,
      isAddressLoading: false,
      isLibSuccess: false,
      isContractSuccess: false,
      libError: '',
      contractError: '',
      queryError: '',
    });
    setResult({});
  }

  function reportError(error, type) {
    updateStatus({
      isLibLoading: false,
      isContractLoading: false,
      isPrefixLoading: false,
      isAddressLoading: false,
      [`${type || ''}Error`]: error,
    });
  }

  function downloadTxtFile() {
    const element = document.createElement('a');
    const file = new Blob(
      [
        document.getElementById('libLogs')?.textContent,
        document.getElementById('contractLogs')?.textContent,
      ],
      { type: 'text/plain' }
    );
    element.href = URL.createObjectURL(file);
    element.download = `${name}-${'mainnet'}-dnssec-log.txt`;
    document.body.appendChild(element);
    element.click();
  }

  useEffect(() => {
    utils.logQueue.subscribe((log) => {
      const logContent = log?.[0];
      if (log._meta.name === 'dnsprovejs') {
        setLogs((prev) => ({
          ...prev,
          libLogs: [...prev.libLogs, logContent],
        }));
        if (logContent.includes('Could not verify')) {
          reportError(logContent, 'lib');
          return;
        }
        updateStatus({ isLibLoading: true });
      } else if (log._meta.name === 'dnssec-debugger') {
        setLogs((prev) => ({
          ...prev,
          contractLogs: [...prev.contractLogs, logContent],
        }));
        updateStatus({
          isLibLoading: false,
          isLibSuccess: true,
          isContractLoading: true,
        });
      }
    });
  }, []);

  useIsomorphicLayoutEffect(() => {
    refLibEOF.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [logs.libLogs]);

  useIsomorphicLayoutEffect(() => {
    refContractEOF.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    });
  }, [logs.contractLogs]);

  return (
    <div>
      <div as="main" className="container container--large">
        <Card title="DNSSEC Debugger">
          <Form
            onSubmit={(e) => {
              e.preventDefault();
              name && queryName(chain.id, name);
            }}
          >
            <Select
              options={NETWORKS.map((n) => ({
                value: n.id.toString(),
                label: n.label,
              }))}
              onChange={(e) => switchNetwork(Number(e.target.value))}
              label="Network"
              value={'1'}
            />
            <Input
              label="DNS Name"
              placeholder="ens.domains"
              onChange={(e) => setName(e.target.value)}
            />
            <Button disabled={!address} colorStyle="greenPrimary" type="submit">
              {!address ? 'No Name' : 'Debug!'}
            </Button>
          </Form>
        </Card>
        <DebugDetails
          open={status.isLibLoading || !!status.libError}
          onClick={(e) =>
            !status.isLibSuccess && !status.libError && e.preventDefault()
          }
        >
          <DebugTitle
            enabled={status.isLoading || !!resultCount || !!status.libError}
          >
            {(status.isLibSuccess || status.libError) && (
              <IconWrapper color={status.libError ? 'red' : 'green'}>
                {status.libError ? <CrossSVG /> : <CheckSVG />}
              </IconWrapper>
            )}
            <SpinnerWrapper hidden={!status.isLibLoading}>
              <Spinner color="accent" />
            </SpinnerWrapper>
            Verifying with DNSProveJS
          </DebugTitle>
          <Debugger id="libLogs">
            {logs.libLogs.map((log, index) => (
              <CodeBlock key={`libLog-${index}`}>{log}</CodeBlock>
            ))}
            <EOF ref={refLibEOF} />
          </Debugger>
        </DebugDetails>
        <DebugDetails
          open={status.isContractLoading || !!status.contractError}
          onClick={(e) =>
            !status.isContractSuccess &&
            !status.contractError &&
            e.preventDefault()
          }
        >
          <DebugTitle
            enabled={
              status.isLoading || !!resultCount || !!status.contractError
            }
          >
            {(status.isContractSuccess || status.contractError) && (
              <IconWrapper color={status.contractError ? 'red' : 'green'}>
                {status.contractError ? <CrossSVG /> : <CheckSVG />}
              </IconWrapper>
            )}
            <SpinnerWrapper hidden={!status.isContractLoading}>
              <Spinner color="accent" />
            </SpinnerWrapper>
            Verifying with DNSSECImpl Contract
          </DebugTitle>
          <Debugger id="contractLogs">
            {logs.contractLogs.map((log, index) => (
              <CodeBlock key={`contractLog-${index}`}>{log}</CodeBlock>
            ))}
            <EOF ref={refContractEOF} />
          </Debugger>
        </DebugDetails>
        <DebugTitleRaw
          enabled={status.isLoading || !!resultCount || !!status.contractError}
        >
          {!status.isPrefixLoading && !!resultCount && (
            <IconWrapper color={!result.txt ? 'red' : 'green'}>
              {!result.txt ? <CrossSVG /> : <CheckSVG />}
            </IconWrapper>
          )}
          <SpinnerWrapper hidden={!status.isPrefixLoading}>
            <Spinner color="accent" />
          </SpinnerWrapper>
          ENS1 prefixed TXT record set correctly
        </DebugTitleRaw>
        <DebugTitleRaw
          enabled={status.isLoading || !!resultCount || !!status.contractError}
        >
          {!status.isAddressLoading && !!resultCount && (
            <IconWrapper color={!result.address ? 'red' : 'green'}>
              {!result.address ? <CrossSVG /> : <CheckSVG />}
            </IconWrapper>
          )}
          <SpinnerWrapper hidden={!status.isAddressLoading}>
            <Spinner color="accent" />
          </SpinnerWrapper>
          Ethereum address set correctly
        </DebugTitleRaw>
        {resultCount > 0 && (
          <Card>
            <SkeletonGroup loading={status.isLoading}>
              {Object.entries(result).map(([key, item], index) => (
                <Skeleton key={`result-${index}`}>
                  <div>
                    <b>{key}:</b>{' '}
                    {item && key === 'address' ? (
                      <span>
                        {item}
                        <a
                          href={`https://${
                            chain.id !== 1 ? `${chain.name}.` : ''
                          }etherscan.io/address/${item}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <IconWrapper color="rgb(56, 136, 255)">
                            <LinkSVG />
                          </IconWrapper>
                        </a>
                      </span>
                    ) : (
                      item || 'Not found'
                    )}
                  </div>
                </Skeleton>
              ))}
            </SkeletonGroup>
          </Card>
        )}
        {((!status.isLoading && !!resultCount) ||
          status.libError ||
          status.contractError) && (
          <LogDownloader onClick={downloadTxtFile}>Download Logs</LogDownloader>
        )}
      </div>
    </div>
  );
}
