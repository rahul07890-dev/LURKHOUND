'use client'

/* Leaping jaguar silhouette icon — brand mark for LurkHound
   Matches the classic Jaguar car-brand style: sleek cat in a full-stretch leap */
export default function PantherIcon({ size = 18, className = '' }: { size?: number; className?: string }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 32 32"
            fill="currentColor"
            className={className}
            xmlns="http://www.w3.org/2000/svg"
        >
            {/* Leaping jaguar — full body, stretched mid-pounce facing right */}
            <path d="
                M2 18.5
                C2.5 17, 4 15.5, 5.5 15
                C6 14.5, 6.5 13, 6 12
                L5 10.5
                C5 10, 5.5 9.5, 6 9.5
                L7.5 10
                C8 10, 8.5 9.5, 8.5 9
                L8 7.5
                C8 7, 8.5 6.5, 9 7
                L10 8.5
                C10.5 9, 11 9, 11.5 8.5
                L13 7
                C14 6.5, 15.5 6.5, 17 7.5
                C18 8, 19 9, 19.5 10
                C20.5 10.5, 22 11, 23 11
                C24 11, 25.5 11.5, 27 12.5
                C28 13.2, 29 14, 29.5 15
                C30 15.8, 30 16.5, 29.5 17
                C29 17.5, 28 17.5, 27 17
                C26 16.5, 25 16, 24 16
                C23 16, 22 16.5, 21 17
                C20 17.8, 19 18.5, 17.5 19
                C16 19.5, 14.5 19.5, 13 19
                C12 18.5, 11 18, 10 18
                C9 18, 7.5 19, 6.5 20
                C5.5 21, 4.5 22, 3 23
                C2.5 23.5, 2 23, 2 22.5
                C2 21.5, 2.5 20, 3.5 19.5
                L2 18.5 Z
            " />
            {/* Rear leg */}
            <path d="
                M6.5 20
                C7 21.5, 6.5 23, 5.5 24.5
                C5 25, 5 25.5, 5.5 25.5
                C6 25.5, 7 24.5, 8 23
                C8.5 22, 9 21, 9.5 19.5
            " opacity="0.85" />
            {/* Front leg */}
            <path d="
                M24 16
                C24.5 17.5, 25 19, 25 20.5
                C25 21.5, 25.5 22, 26 22
                C26.5 22, 27 21, 26.5 19.5
                C26 18.5, 25.5 17, 25 16
            " opacity="0.85" />
            {/* Eye dot */}
            <circle cx="9.5" cy="8.2" r="0.6" fill="#0c0e12" />
        </svg>
    )
}
