import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Branded loading animation: a "K" tile pulsing inside a rotating arc, with
/// three bouncing dots underneath. [light] is for use on the brand-blue
/// background (splash).
class BrandLoader extends StatefulWidget {
  const BrandLoader({
    super.key,
    this.size = 72,
    this.light = false,
    this.dots = true,
    this.mark = true,
  });

  const BrandLoader.small({
    super.key,
    this.light = false,
    this.dots = false,
    this.mark = true,
  }) : size = 20;

  final double size;
  final bool light;
  final bool dots;

  /// Draw the "K" tile in the middle (off when a logo is already on screen).
  final bool mark;

  @override
  State<BrandLoader> createState() => _BrandLoaderState();
}

class _BrandLoaderState extends State<BrandLoader>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  )..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    final accent = widget.light ? Colors.white : primary;
    final s = widget.size;
    final reduced = MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    return Semantics(
      label: 'Loading',
      child: TickerMode(
        enabled: !reduced,
        child: AnimatedBuilder(
          animation: _c,
          builder:
              (context, _) =>
                  _buildContent(context, reduced ? 0 : _c.value, accent, s),
        ),
      ),
    );
  }

  Widget _buildContent(BuildContext context, double t, Color accent, double s) {
    final pulse = 0.94 + 0.06 * math.sin(t * 2 * math.pi);
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          width: s,
          height: s,
          child: Stack(
            alignment: Alignment.center,
            children: [
              RepaintBoundary(
                child: CustomPaint(
                  size: Size.square(s),
                  painter: _ArcPainter(t, accent),
                ),
              ),
              if (widget.mark)
                Transform.scale(
                  scale: pulse,
                  child: Container(
                    width: s * 0.62,
                    height: s * 0.62,
                    padding: EdgeInsets.all(s * 0.1),
                    decoration: BoxDecoration(
                      color: widget.light ? Colors.white : null,
                      borderRadius: BorderRadius.circular(s * 0.16),
                    ),
                    child: Image.asset('assets/brand/khmerx-mark.png'),
                  ),
                ),
            ],
          ),
        ),
        if (widget.dots) ...[
          SizedBox(height: s * 0.22),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (var i = 0; i < 3; i++)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 3),
                  child: Transform.translate(
                    offset: Offset(
                      0,
                      -6 * math.max(0, math.sin((t - i * 0.12) * 2 * math.pi)),
                    ),
                    child: Container(
                      width: 7,
                      height: 7,
                      decoration: BoxDecoration(
                        color: accent.withValues(alpha: 0.85),
                        shape: BoxShape.circle,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ],
      ],
    );
  }
}

class _ArcPainter extends CustomPainter {
  _ArcPainter(this.t, this.color);
  final double t;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final base =
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = size.width * 0.05
          ..strokeCap = StrokeCap.round
          ..color = color.withValues(alpha: 0.18);
    final r = rect.deflate(size.width * 0.03);
    final arc =
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = size.width * 0.05
          ..strokeCap = StrokeCap.round
          ..shader = SweepGradient(
            colors: [
              color.withValues(alpha: 0.25),
              color,
              color.withValues(alpha: 0.25),
            ],
            stops: const [0, 0.55, 1],
            transform: GradientRotation(t * 2 * math.pi),
          ).createShader(r);
    canvas.drawArc(r, 0, math.pi * 2, false, base);
    canvas.drawArc(r, t * 2 * math.pi - math.pi / 2, math.pi * 0.7, false, arc);
  }

  @override
  bool shouldRepaint(_ArcPainter old) => old.t != t || old.color != color;
}

/// Full-logo loading variant for splash and large empty states.
final class BrandLogoLoader extends StatefulWidget {
  const BrandLogoLoader({super.key, this.width = 240, this.light = false});

  final double width;
  final bool light;

  @override
  State<BrandLogoLoader> createState() => _BrandLogoLoaderState();
}

final class _BrandLogoLoaderState extends State<BrandLogoLoader>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1500),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduced = MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    final accent =
        widget.light ? Colors.white : Theme.of(context).colorScheme.primary;
    return Semantics(
      label: 'Loading',
      child: TickerMode(
        enabled: !reduced,
        child: AnimatedBuilder(
          animation: _controller,
          builder: (context, _) {
            final t = reduced ? 0.0 : _controller.value;
            final pulse = 0.985 + 0.015 * math.sin(t * 2 * math.pi);
            return Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Transform.scale(
                  scale: pulse,
                  child: Image.asset(
                    'assets/brand/khmerx-logo.png',
                    width: widget.width,
                    colorBlendMode: widget.light ? BlendMode.srcIn : null,
                    color: widget.light ? Colors.white : null,
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: widget.width * 0.36,
                  height: 5,
                  child: CustomPaint(painter: _ArcPainter(t, accent)),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
