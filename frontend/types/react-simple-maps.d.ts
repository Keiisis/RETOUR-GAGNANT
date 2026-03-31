/* eslint-disable @typescript-eslint/no-explicit-any */
declare module 'react-simple-maps' {
    import { ReactNode, SVGProps, MouseEvent } from 'react'

    interface ProjectionConfig {
        scale?: number
        center?: [number, number]
        rotate?: [number, number, number]
        parallels?: [number, number]
    }

    interface ComposableMapProps {
        projection?: string
        projectionConfig?: ProjectionConfig
        width?: number
        height?: number
        style?: React.CSSProperties
        className?: string
        children?: ReactNode
    }

    interface ZoomableGroupProps {
        center?: [number, number]
        zoom?: number
        minZoom?: number
        maxZoom?: number
        translateExtent?: [[number, number], [number, number]]
        onMoveStart?: (pos: any) => void
        onMove?: (pos: any) => void
        onMoveEnd?: (pos: any) => void
        children?: ReactNode
    }

    interface GeographiesProps {
        geography: string | object
        children: (args: { geographies: any[] }) => ReactNode
    }

    interface GeographyProps extends SVGProps<SVGPathElement> {
        geography: any
        style?: {
            default?: React.CSSProperties
            hover?: React.CSSProperties
            pressed?: React.CSSProperties
        }
    }

    interface MarkerProps {
        coordinates: [number, number]
        children?: ReactNode
        onMouseEnter?: (evt: MouseEvent<SVGGElement>) => void
        onMouseLeave?: (evt: MouseEvent<SVGGElement>) => void
        onClick?: (evt: MouseEvent<SVGGElement>) => void
        style?: React.CSSProperties
        className?: string
    }

    export function ComposableMap(props: ComposableMapProps): JSX.Element
    export function ZoomableGroup(props: ZoomableGroupProps): JSX.Element
    export function Geographies(props: GeographiesProps): JSX.Element
    export function Geography(props: GeographyProps): JSX.Element
    export function Marker(props: MarkerProps): JSX.Element
}
