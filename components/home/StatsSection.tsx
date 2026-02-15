'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';

const stats = [
    { label: "Projets Réalisés", target: 500, suffix: "+" },
    { label: "Clients Satisfaits", target: 98, suffix: "%" },
    { label: "Années d'Expérience", target: 15, suffix: "+" },
    { label: "Support", target: 24, suffix: "/7" },
];

function Counter({ target, suffix }: { target: number, suffix: string }) {
    const [count, setCount] = useState(0);
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-50px" });

    useEffect(() => {
        if (isInView) {
            let start = 0;
            const duration = 2000;
            const increment = target / (duration / 16);

            const timer = setInterval(() => {
                start += increment;
                if (start >= target) {
                    setCount(target);
                    clearInterval(timer);
                } else {
                    setCount(Math.ceil(start));
                }
            }, 16);

            return () => clearInterval(timer);
        }
    }, [isInView, target]);

    return (
        <span ref={ref} className="font-heading font-bold text-5xl md:text-6xl text-secondary">
            {count}{suffix}
        </span>
    );
}

export default function StatsSection() {
    return (
        <section className="py-20 bg-primary/95 text-white">
            <div className="container mx-auto px-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
                    {stats.map((stat, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            viewport={{ once: true }}
                            className="text-center space-y-2"
                        >
                            <Counter target={stat.target} suffix={stat.suffix || ""} />
                            <p className="text-lg opacity-90 font-light">{stat.label}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
