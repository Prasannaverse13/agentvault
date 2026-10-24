"use client";

import { useEffect, useRef } from "react";

/**
 * A slow, quiet field of 3D coins behind the landing page. It reacts to the
 * mouse and to scrolling, stops for reduced-motion users, and quietly renders
 * nothing if WebGL is unavailable.
 */
export function Background3D() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    let cleanup: (() => void) | undefined;

    void import("three").then((THREE) => {
      if (disposed) return;

      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
      } catch {
        return; // no WebGL: the page still looks right without the backdrop
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      mount.appendChild(renderer.domElement);

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
      camera.position.set(0, 0, 16);

      scene.add(new THREE.HemisphereLight(0xffffff, 0xcfe8bd, 1.15));
      const key = new THREE.DirectionalLight(0xffffff, 2.1);
      key.position.set(5, 8, 10);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0x9fe870, 1.2);
      rim.position.set(-8, -4, 6);
      scene.add(rim);

      // Coin faces are drawn on a canvas so the symbol is crisp and on-brand.
      const textures: InstanceType<typeof THREE.CanvasTexture>[] = [];
      const face = (symbol: string, bg: string, fg: string) => {
        const size = 256;
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, size, size);
          ctx.strokeStyle = fg;
          ctx.globalAlpha = 0.35;
          ctx.lineWidth = 8;
          ctx.beginPath();
          ctx.arc(size / 2, size / 2, size * 0.4, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.fillStyle = fg;
          ctx.font = "900 150px Inter, Arial, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(symbol, size / 2, size / 2 + 8);
        }
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 4;
        textures.push(texture);
        return texture;
      };

      const lime = 0x9fe870;
      const forest = 0x163300;
      const variants = [
        { symbol: "₿", bg: "#9fe870", fg: "#163300", side: lime },
        { symbol: "$", bg: "#163300", fg: "#9fe870", side: forest },
        { symbol: "₿", bg: "#e2f6d5", fg: "#163300", side: 0xcfe8bd },
      ].map((v) => {
        const map = face(v.symbol, v.bg, v.fg);
        const sideMat = new THREE.MeshStandardMaterial({ color: v.side, metalness: 0.25, roughness: 0.4 });
        const faceMat = new THREE.MeshStandardMaterial({ map, metalness: 0.15, roughness: 0.38 });
        return { materials: [sideMat, faceMat, faceMat], sideMat, faceMat };
      });

      const geometry = new THREE.CylinderGeometry(1, 1, 0.22, 56);
      const coins: {
        mesh: InstanceType<typeof THREE.Mesh>;
        base: InstanceType<typeof THREE.Vector3>;
        /** Horizontal slot as a fraction of the visible half-width (sign = side). */
        slot: number;
        spin: InstanceType<typeof THREE.Vector3>;
        phase: number;
        bob: number;
        size: number;
      }[] = [];

      const rand = (min: number, max: number) => min + Math.random() * (max - min);
      const COUNT = 22;
      const SPAN = 30; // world height the coins are spread over (the page scrolls through it)

      for (let i = 0; i < COUNT; i += 1) {
        const variant = variants[i % variants.length];
        const mesh = new THREE.Mesh(geometry, variant.materials);
        const scale = rand(0.55, 1.35);
        mesh.scale.setScalar(scale);
        const side = i % 2 === 0 ? -1 : 1;
        // Keep the middle clear so headlines stay readable.
        const slot = side * rand(0.8, 1.12);
        const base = new THREE.Vector3(0, -((i / COUNT) * SPAN) + rand(1, 4), rand(-6, 1));
        mesh.position.copy(base);
        mesh.rotation.set(rand(0, Math.PI), rand(0, Math.PI), rand(0, Math.PI));
        scene.add(mesh);
        coins.push({
          size: scale,
          mesh,
          base,
          slot,
          spin: new THREE.Vector3(rand(0.1, 0.45), rand(0.15, 0.55), rand(0.05, 0.25)),
          phase: rand(0, Math.PI * 2),
          bob: rand(0.2, 0.6),
        });
      }

      const mouse = { x: 0, y: 0 };
      const smooth = { x: 0, y: 0, scroll: 0 };

      const resize = () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        renderer.setSize(w, h, false);
        renderer.domElement.style.width = "100%";
        renderer.domElement.style.height = "100%";
        camera.aspect = w / h;
        // On narrow screens, pull the camera back so coins hug the edges.
        camera.position.z = w < 700 ? 22 : 16;
        camera.updateProjectionMatrix();
        // Slots are relative to the visible width so the centre column stays clear on any screen.
        const narrow = w < 700;
        for (const coin of coins) {
          // Visible half-width at this coin's own depth, so near coins do not drift inwards.
          const halfWidth =
            Math.tan((camera.fov * Math.PI) / 360) * (camera.position.z - coin.base.z) * camera.aspect;
          coin.base.x = coin.slot * halfWidth * (narrow ? 1.05 : 1);
          coin.mesh.scale.setScalar(coin.size * (narrow ? 0.7 : 1));
        }
      };

      const onMove = (event: MouseEvent) => {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = (event.clientY / window.innerHeight) * 2 - 1;
      };
      resize();
      window.addEventListener("resize", resize);
      window.addEventListener("mousemove", onMove, { passive: true });

      const clock = new THREE.Clock();
      let raf = 0;
      let running = true;

      const frame = () => {
        raf = requestAnimationFrame(frame);
        if (!running) return;
        const t = clock.getElapsedTime();

        const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        const scrollTarget = Math.min(1, window.scrollY / maxScroll);
        smooth.scroll += (scrollTarget - smooth.scroll) * 0.06;
        smooth.x += (mouse.x - smooth.x) * 0.04;
        smooth.y += (mouse.y - smooth.y) * 0.04;

        // Scrolling travels down through the coin field; the mouse adds depth.
        camera.position.y = -smooth.scroll * (SPAN - 6);
        camera.position.x = smooth.x * 1.2;
        camera.lookAt(smooth.x * 0.6, camera.position.y - smooth.y * 0.6, 0);

        for (const coin of coins) {
          coin.mesh.rotation.x += coin.spin.x * 0.01;
          coin.mesh.rotation.y += coin.spin.y * 0.01;
          coin.mesh.rotation.z += coin.spin.z * 0.01;
          coin.mesh.position.y = coin.base.y + Math.sin(t * 0.6 + coin.phase) * coin.bob;
          coin.mesh.position.x = coin.base.x + Math.cos(t * 0.35 + coin.phase) * 0.25;
        }
        renderer.render(scene, camera);
      };

      if (reduceMotion) {
        renderer.render(scene, camera);
      } else {
        frame();
      }

      const onVisibility = () => {
        running = !document.hidden;
      };
      document.addEventListener("visibilitychange", onVisibility);

      cleanup = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", resize);
        window.removeEventListener("mousemove", onMove);
        document.removeEventListener("visibilitychange", onVisibility);
        geometry.dispose();
        variants.forEach((v) => {
          v.sideMat.dispose();
          v.faceMat.dispose();
        });
        textures.forEach((texture) => texture.dispose());
        renderer.dispose();
        renderer.domElement.remove();
      };
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  return <div ref={mountRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-0" />;
}
