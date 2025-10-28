import React from 'react';
import clsx from 'clsx';

type ButtonVariant = 'primary' | 'ghost';
type ButtonElement = HTMLButtonElement | HTMLAnchorElement;

type ButtonBaseProps = {
  variant?: ButtonVariant;
  loading?: boolean;
  className?: string;
  children: React.ReactNode;
};

type ButtonAsButton = ButtonBaseProps &
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    as?: 'button';
  };

type ButtonAsAnchor = ButtonBaseProps &
  React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    as: 'a';
    href: string;
  };

export type ButtonProps = ButtonAsButton | ButtonAsAnchor;

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-[#3B82F6] text-white hover:bg-[#60A5FA] focus-visible:outline-[#3B82F6]',
  ghost:
    'border border-white/20 text-white/80 hover:border-white hover:text-white focus-visible:outline-white/80',
};

export const Button = React.forwardRef<ButtonElement, ButtonProps>(
  (
    {
      as = 'button',
      variant = 'primary',
      loading = false,
      disabled,
      className,
      children,
      ...rest
    },
    forwardedRef,
  ) => {
    const Comp: 'button' | 'a' = as;
    const isDisabled = disabled || loading;

    const content = (
      <>
        <span className={clsx({ 'opacity-0': loading })}>{children}</span>
        {loading ? (
          <span
            className="absolute inset-0 flex items-center justify-center text-sm font-semibold"
            aria-hidden="true"
          >
            …
          </span>
        ) : null}
      </>
    );

    const sharedProps = {
      ref: forwardedRef as never,
      'data-variant': variant,
      className: clsx(
        'relative inline-flex h-11 items-center justify-center rounded-xl px-6 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
        variantClasses[variant],
        isDisabled && 'cursor-not-allowed opacity-60',
        className,
      ),
      'aria-busy': loading || undefined,
      'aria-disabled': isDisabled || undefined,
      children: content,
    };

    if (Comp === 'button') {
      const buttonProps = rest as React.ButtonHTMLAttributes<HTMLButtonElement>;
      return (
        <button
          {...sharedProps}
          type={buttonProps.type ?? 'button'}
          disabled={isDisabled}
          {...buttonProps}
        />
      );
    }

    const anchorProps = rest as React.AnchorHTMLAttributes<HTMLAnchorElement>;

    return (
      <Comp
        {...sharedProps}
        {...anchorProps}
        href={isDisabled ? undefined : anchorProps.href}
        role="button"
        tabIndex={isDisabled ? -1 : anchorProps.tabIndex}
        onClick={(event) => {
          if (isDisabled) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          anchorProps.onClick?.(event);
        }}
      />
    );
  },
);

Button.displayName = 'Button';
