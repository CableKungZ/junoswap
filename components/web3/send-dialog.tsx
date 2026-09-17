'use client'

import { useState, useEffect } from 'react'
import type { Token } from '@/types/token'
import type { RecipientIssue } from '@/lib/tokens'
import { useAccount, useChainId } from 'wagmi'
import type { Address } from 'viem'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TokenSelect } from '@/components/swap/token-select'
import { useChainTokens } from '@/hooks/useChainTokens'
import { useTokenBalance } from '@/hooks/useTokenBalance'
import { useSendToken } from '@/hooks/useSendToken'
import { useOnTxSuccess } from '@/hooks/useOnTxSuccess'
import { isValidNumberInput } from '@/lib/utils'
import {
    isValidTokenAddress,
    getRecipientIssue,
    formatBalance,
    formatTokenAmount,
    parseTokenAmount,
} from '@/lib/tokens'
import { getExplorerTxUrl } from '@/lib/explorer'
import { toastError } from '@/lib/toast'
import { TxFlowDialog, actionStep } from '@/components/ui/tx-flow-dialog'
import { TxStageFlow } from '@/components/ui/tx-stage'
import { Check } from 'lucide-react'
const RECIPIENT_ISSUE_TEXT: Record<RecipientIssue, string> = {
    zero: 'This is the zero address — tokens sent here are burned.',
    'token-contract': "This is the token's own contract — tokens sent here are usually lost.",
    self: 'This is your own wallet.',
}

interface SendDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function SendDialog({ open, onOpenChange }: SendDialogProps) {
    const { address } = useAccount()
    const chainId = useChainId()
    const { tokens } = useChainTokens(chainId)

    const [selectedToken, setSelectedToken] = useState<Token | null>(null)
    const [recipientInput, setRecipientInput] = useState('')
    const [amount, setAmount] = useState('')
    const [txOpen, setTxOpen] = useState(false)

    useEffect(() => {
        if (tokens.length === 0) return
        const stillPresent =
            selectedToken &&
            tokens.some(
                (t) => t.address === selectedToken.address && t.chainId === selectedToken.chainId
            )
        if (!stillPresent) setSelectedToken(tokens[0] ?? null)
    }, [tokens, selectedToken])

    const { balance, refetch } = useTokenBalance({
        token: selectedToken,
        address: address as Address | undefined,
    })

    const trimmedRecipient = recipientInput.trim()
    const isValidRecipient = isValidTokenAddress(trimmedRecipient)
    const recipient: Address | null = isValidRecipient ? (trimmedRecipient as Address) : null

    const recipientIssue = recipient
        ? getRecipientIssue(recipient, address, selectedToken?.address)
        : null

    const {
        send,
        isPreparing,
        isExecuting,
        isConfirming,
        isSuccess,
        isError,
        error,
        hash,
        simulationError,
        reset,
    } = useSendToken({ token: selectedToken, recipient, amount })

    const rawAmount =
        selectedToken && amount ? parseTokenAmount(amount, selectedToken.decimals) : 0n
    const hasInsufficientBalance = !!selectedToken && rawAmount > 0n && rawAmount > balance
    const isBusy = isExecuting || isConfirming
    const canSend =
        !!selectedToken &&
        isValidRecipient &&
        recipientIssue !== 'zero' &&
        recipientIssue !== 'token-contract' &&
        rawAmount > 0n &&
        !hasInsufficientBalance &&
        !isPreparing &&
        !isBusy

    const handleMax = () => {
        if (selectedToken && balance > 0n) {
            setAmount(formatTokenAmount(balance, selectedToken.decimals))
        }
    }

    useOnTxSuccess(true, isSuccess, hash, (hash) => {
        const explorerUrl = getExplorerTxUrl(chainId, hash)
        toast.success('Send successful!', {
            action: {
                label: 'View Transaction',
                onClick: () => window.open(explorerUrl, '_blank', 'noopener,noreferrer'),
            },
        })
        // The tx dialog owns the success frame and closes both from its Done button.
        refetch()
    })

    useEffect(() => {
        if (isError && error) {
            toastError(error, 'Send failed')
        }
    }, [isError, error])

    useEffect(() => {
        if (!open) {
            reset()
            setAmount('')
            setRecipientInput('')
        }
    }, [open, reset])

    const handleSend = () => {
        setTxOpen(true)
        send()
    }
    const txSteps = selectedToken
        ? [
              actionStep({
                  label: `Send ${selectedToken.symbol}`,
                  flags: {
                      isPending: isExecuting,
                      isConfirming,
                      isSuccess,
                      isError,
                      error,
                      hash,
                      simulationError,
                  },
                  run: send,
                  renderStage: (phase) => (
                      <TxStageFlow
                          phase={phase}
                          chainId={chainId}
                          hash={hash}
                          from={{ kind: 'token', token: selectedToken, amount: amount || '0' }}
                          to={{
                              kind: 'contract',
                              label: 'Recipient',
                              address: recipient ?? undefined,
                              amount: `${amount || '0'} ${selectedToken.symbol}`,
                          }}
                      />
                  ),
              }),
          ]
        : []

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent
                    className="sm:max-w-md bg-card/95 backdrop-blur-md border-border/50"
                    aria-describedby="send-description"
                >
                    <DialogHeader>
                        <DialogTitle className="text-lg">Send</DialogTitle>
                    </DialogHeader>
                    <p id="send-description" className="sr-only">
                        Transfer tokens to another wallet address
                    </p>

                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Recipient</span>
                                {isValidRecipient ? (
                                    <span className="flex items-center gap-1 text-xs text-positive">
                                        <Check className="h-3 w-3" aria-hidden="true" /> Valid
                                        address
                                    </span>
                                ) : recipientInput ? (
                                    <span className="text-xs text-muted-foreground/70">
                                        Invalid address
                                    </span>
                                ) : null}
                            </div>
                            <Input
                                placeholder="0x... recipient address"
                                value={recipientInput}
                                onChange={(e) => setRecipientInput(e.target.value)}
                                spellCheck={false}
                                autoComplete="off"
                                className="font-mono text-sm"
                            />
                        </div>

                        <div className="rounded-xl border bg-card p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <span
                                    className={`text-xs ${
                                        balance > 0n
                                            ? 'text-muted-foreground cursor-pointer hover:underline'
                                            : 'text-muted-foreground'
                                    }`}
                                    onClick={handleMax}
                                >
                                    Balance: {formatBalance(balance, selectedToken?.decimals ?? 18)}
                                </span>
                                <TokenSelect
                                    token={selectedToken}
                                    tokens={tokens}
                                    onSelect={setSelectedToken}
                                />
                            </div>
                            <Input
                                type="text"
                                placeholder="0"
                                autoComplete="off"
                                inputMode="decimal"
                                pattern="^[0-9]*\.?[0-9]*$"
                                value={amount}
                                onChange={(e) => {
                                    if (isValidNumberInput(e.target.value))
                                        setAmount(e.target.value)
                                }}
                                className="flex-1 h-10 text-2xl font-medium md:text-2xl p-0"
                            />
                        </div>

                        {recipientIssue && (
                            <p
                                className={
                                    recipientIssue === 'self'
                                        ? 'text-xs text-muted-foreground'
                                        : 'text-xs text-destructive'
                                }
                            >
                                {RECIPIENT_ISSUE_TEXT[recipientIssue]}
                            </p>
                        )}

                        {hasInsufficientBalance && (
                            <p className="text-xs text-destructive">Insufficient balance</p>
                        )}

                        <Button
                            className="w-full"
                            size="lg"
                            onClick={handleSend}
                            disabled={!canSend}
                            isLoading={isBusy || (isPreparing && rawAmount > 0n)}
                            loadingText={
                                isConfirming ? 'Confirming…' : isBusy ? 'Sending…' : 'Checking…'
                            }
                        >
                            Send
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Its own Radix root, outside this one, so the two modals don't fight over focus. */}
            <TxFlowDialog
                open={txOpen}
                onOpenChange={setTxOpen}
                title="Send"
                steps={txSteps}
                chainId={chainId}
                onDone={() => {
                    reset()
                    setAmount('')
                    setRecipientInput('')
                    onOpenChange(false)
                }}
            />
        </>
    )
}
