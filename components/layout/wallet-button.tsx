"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAccount, useConnect, useDisconnect, useSignMessage, useSwitchChain } from "wagmi";
import { injected } from "wagmi/connectors";
import { base } from "wagmi/chains";
import { cn } from "@/lib/utils";
import { useWalletAuth } from "@/contexts/wallet-auth-context";

const SIGN_MESSAGE =
  "欢迎使用 VVVeco！请签名以验证您是该钱包的所有者。此签名不会花费任何 Gas 费用。";

function shortAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

const BASE_ICON_URI =
  "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2228%22%20height%3D%2228%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cpath%20fill%3D%22%230052FF%22%20fill-rule%3D%22nonzero%22%20d%3D%22M14%2028a14%2014%200%201%200%200-28%2014%2014%200%200%200%200%2028Z%22%2F%3E%3Cpath%20fill%3D%22%23FFF%22%20d%3D%22M13.967%2023.86c5.445%200%209.86-4.415%209.86-9.86%200-5.445-4.415-9.86-9.86-9.86-5.166%200-9.403%203.974-9.825%209.03h14.63v1.642H4.142c.413%205.065%204.654%209.047%209.826%209.047Z%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E";

function BaseIcon({ size }: { size: "sm" | "md" }) {
  const px = size === "sm" ? 16 : 20;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={BASE_ICON_URI} width={px} height={px} alt="Base" className="shrink-0 rounded-full" />
  );
}

/* ─── 签名验证弹窗 ─────────────────────────────────────────────────────── */

interface SignVerifyModalProps {
  open: boolean;
  onClose: () => void;
  wagmiAddress: string | undefined;
  isSigning: boolean;
  dialogError: string | null;
  onConfirm: () => void;
}

function SignVerifyModal({ open, onClose, wagmiAddress, isSigning, dialogError, onConfirm }: SignVerifyModalProps) {
  if (!open) return null;

  return createPortal(
    // 全屏容器：用 flex 居中，绕过所有父级 stacking context / transform / backdrop-filter
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100dvh",
        padding: "1rem",
        boxSizing: "border-box",
        // 不使用 backdropFilter，避免 WebKit 嵌套问题
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        WebkitOverflowScrolling: "touch",
      }}
      onClick={(e) => {
        // 点遮罩关闭（签名中禁止）
        if (!isSigning && e.target === e.currentTarget) onClose();
      }}
    >
      {/* 弹窗卡片：全部内联样式保证不受外层 CSS 污染 */}
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "22rem",
          backgroundColor: "var(--background, #1a1a1a)",
          color: "var(--foreground, #fff)",
          borderRadius: "0.75rem",
          border: "1px solid var(--border, rgba(255,255,255,0.12))",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          padding: "1.5rem",
          boxSizing: "border-box",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 关闭按钮 */}
        <button
          onClick={() => !isSigning && onClose()}
          style={{
            position: "absolute",
            top: "0.75rem",
            right: "0.75rem",
            width: "2rem",
            height: "2rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--muted-foreground, rgba(255,255,255,0.5))",
            fontSize: "1.2rem",
            lineHeight: 1,
            borderRadius: "0.25rem",
            touchAction: "manipulation",
          }}
          aria-label="关闭"
        >
          ✕
        </button>

        {/* 标题 */}
        <div style={{ textAlign: "center", marginBottom: "1rem" }}>
          <h2 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600 }}>签名验证</h2>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", color: "var(--muted-foreground, rgba(255,255,255,0.5))" }}>
            请在钱包中确认签名以验证您的身份
          </p>
        </div>

        {/* 钱包地址 */}
        <div style={{
          borderRadius: "0.5rem",
          background: "var(--muted, rgba(255,255,255,0.06))",
          padding: "0.75rem 1rem",
          textAlign: "center",
          marginBottom: "0.75rem",
        }}>
          <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted-foreground, rgba(255,255,255,0.5))" }}>钱包地址</p>
          <p style={{ margin: "0.25rem 0 0", fontFamily: "monospace", fontSize: "0.875rem", wordBreak: "break-all" }}>
            {wagmiAddress ?? "待连接"}
          </p>
        </div>

        {/* 签名消息 */}
        <div style={{
          borderRadius: "0.5rem",
          border: "1px solid var(--border, rgba(255,255,255,0.12))",
          padding: "0.75rem 1rem",
          marginBottom: "0.75rem",
        }}>
          <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted-foreground, rgba(255,255,255,0.5))" }}>签名消息</p>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", lineHeight: 1.6 }}>{SIGN_MESSAGE}</p>
        </div>

        {/* 错误提示 */}
        {dialogError && (
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.75rem", color: "#f87171", textAlign: "center" }}>
            {dialogError}
          </p>
        )}

        {/* 确认签名按钮 */}
        <button
          onClick={onConfirm}
          disabled={isSigning}
          style={{
            display: "block",
            width: "100%",
            minHeight: "2.75rem",
            padding: "0.625rem 1rem",
            borderRadius: "0.5rem",
            border: "none",
            background: isSigning ? "rgba(249,115,22,0.5)" : "var(--primary, #f97316)",
            color: "#fff",
            fontSize: "0.9375rem",
            fontWeight: 600,
            cursor: isSigning ? "not-allowed" : "pointer",
            touchAction: "manipulation",
            boxSizing: "border-box",
          }}
        >
          {isSigning ? "签名中..." : "确认签名"}
        </button>

        {/* 底部说明 */}
        <p style={{ margin: "0.75rem 0 0", fontSize: "0.75rem", color: "var(--muted-foreground, rgba(255,255,255,0.5))", textAlign: "center" }}>
          签名仅用于验证身份，不会产生任何费用
        </p>
      </div>
    </div>,
    document.body
  );
}

/* ─── WalletButton ─────────────────────────────────────────────────────── */

interface WalletButtonProps {
  className?: string;
  size?: "sm" | "md";
}

export function WalletButton({ className, size = "md" }: WalletButtonProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { address: wagmiAddress, isConnected, chain } = useAccount();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { connect } = useConnect();
  const { signMessageAsync } = useSignMessage();
  const { isSigned, signedAddress, setSignedAddress, clearAuth } = useWalletAuth();

  const [showSignVerify, setShowSignVerify] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const pendingSignRef = useRef(false);

  // wagmi 连接成功后自动发起签名
  useEffect(() => {
    if (!pendingSignRef.current) return;
    if (!isConnected || !wagmiAddress) return;
    pendingSignRef.current = false;
    setIsSigning(true);
    setDialogError(null);
    signMessageAsync({ message: SIGN_MESSAGE })
      .then(() => {
        setSignedAddress(wagmiAddress as `0x${string}`);
        setShowSignVerify(false);
      })
      .catch(() => setDialogError("签名已取消，请重试"))
      .finally(() => setIsSigning(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, wagmiAddress]);

  const handleConnect = () => {
    setDialogError(null);
    setShowSignVerify(true);
  };

  const handleConfirmSign = () => {
    setDialogError(null);
    if (isConnected && wagmiAddress) {
      setIsSigning(true);
      signMessageAsync({ message: SIGN_MESSAGE })
        .then(() => {
          setSignedAddress(wagmiAddress as `0x${string}`);
          setShowSignVerify(false);
        })
        .catch(() => setDialogError("签名已取消，请重试"))
        .finally(() => setIsSigning(false));
    } else {
      const hasInjected =
        typeof window !== "undefined" && !!(window as unknown as Record<string, unknown>).ethereum;
      if (!hasInjected) {
        setDialogError("请使用钱包浏览器访问，或安装钱包插件后刷新");
        return;
      }
      pendingSignRef.current = true;
      connect(
        { connector: injected(), chainId: base.id },
        { onError: () => { pendingSignRef.current = false; setDialogError("钱包连接失败，请重试"); } }
      );
    }
  };

  const btnBase = "rounded-full font-medium transition-colors";
  const sizes = { sm: "h-8 px-3 text-xs", md: "h-10 px-4 text-sm" };

  // SSR 占位，避免 hydration 不匹配
  if (!mounted) {
    return (
      <div className="inline-flex items-center gap-1.5">
        <BaseIcon size={size} />
        <button className={cn(btnBase, sizes[size], "bg-primary text-primary-foreground hover:bg-primary/90", className)}>
          连接钱包
        </button>
      </div>
    );
  }

  return (
    <>
      <SignVerifyModal
        open={showSignVerify}
        onClose={() => setShowSignVerify(false)}
        wagmiAddress={wagmiAddress}
        isSigning={isSigning}
        dialogError={dialogError}
        onConfirm={handleConfirmSign}
      />

      {/* 已签名但链不对 */}
      {isSigned && (!chain || chain.id !== base.id) && (
        <button
          onClick={() => switchChain({ chainId: base.id })}
          className={cn("rounded-full font-medium transition-colors", sizes[size], "bg-yellow-500 text-white hover:bg-yellow-600", className)}
        >
          切换到 Base
        </button>
      )}

      {/* 已签名，链正确 */}
      {isSigned && signedAddress && chain?.id === base.id && (
        <button
          onClick={() => { disconnect(); clearAuth(); }}
          className={cn(btnBase, sizes[size], "inline-flex items-center gap-1.5 border border-border bg-background hover:bg-secondary font-mono", className)}
        >
          <BaseIcon size={size} />
          {shortAddress(signedAddress)}
        </button>
      )}

      {/* 未签名 */}
      {!isSigned && (
        <div className="inline-flex items-center gap-1.5">
          <BaseIcon size={size} />
          <button
            onClick={handleConnect}
            style={{ touchAction: "manipulation" }}
            className={cn(btnBase, sizes[size], "bg-primary text-primary-foreground hover:bg-primary/90", className)}
          >
            连接钱包
          </button>
        </div>
      )}
    </>
  );
}
