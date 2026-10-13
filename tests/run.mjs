for(const file of ['./verify.mjs','./building-formats.mjs','./export-metadata.mjs','./physics-stability.mjs','./plant-models.mjs'])await import(file);

await import('./environmental-physics.mjs');

await import('./recording-control.mjs');

await import('./curve-collider-editor.mjs');

await import('./articulation-speed.mjs');

await import('./editor-rope-limits.mjs');

await import('./point-detent.mjs');
await import('./head-shape-features.mjs');
await import('./ragdoll-contacts.mjs');

await import('./head-preview-export.mjs');

await import('./low-poly-shapes.mjs');

await import('./low-poly-render-batches.mjs');

await import('./shape-preview.mjs');

await import('./zero-group-cohesion.mjs');
