/**
 * UI Component Primitives for @jsango/admin-ui
 */
export interface ButtonProps {
    readonly label?: string | undefined;
    readonly variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'success' | undefined;
    readonly size?: 'sm' | 'md' | 'lg' | 'icon' | undefined;
    readonly icon?: string | undefined;
    readonly disabled?: boolean | undefined;
    readonly loading?: boolean | undefined;
    readonly type?: 'button' | 'submit' | 'reset' | undefined;
    readonly onClick?: (() => void) | undefined;
    readonly ariaLabel?: string | undefined;
}
export declare function renderButton(props: ButtonProps): string;
export interface BadgeProps {
    readonly label: string | number;
    readonly variant?: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline' | undefined;
    readonly size?: 'sm' | 'md' | undefined;
}
export declare function renderBadge(props: BadgeProps): string;
export interface InputProps {
    readonly id?: string | undefined;
    readonly name: string;
    readonly type?: string | undefined;
    readonly value?: string | number | undefined;
    readonly placeholder?: string | undefined;
    readonly disabled?: boolean | undefined;
    readonly readonly?: boolean | undefined;
    readonly required?: boolean | undefined;
    readonly error?: string | undefined;
}
export declare function renderInput(props: InputProps): string;
export interface AlertProps {
    readonly type: 'info' | 'success' | 'warning' | 'error';
    readonly title?: string | undefined;
    readonly message: string;
}
export declare function renderAlert(props: AlertProps): string;
export interface SkeletonProps {
    readonly type?: 'line' | 'card' | 'table' | 'avatar' | undefined;
    readonly count?: number | undefined;
}
export declare function renderSkeleton(props: SkeletonProps): string;
//# sourceMappingURL=primitives.d.ts.map