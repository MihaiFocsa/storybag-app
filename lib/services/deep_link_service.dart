import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:uni_links/uni_links.dart';

/// Service for handling deep links in the application
class DeepLinkService extends ChangeNotifier {
  bool _initialized = false;
  StreamSubscription? _linkSubscription;
  String? _initialLink;
  String? _latestLink;

  /// The initial link that launched the app
  String? get initialLink => _initialLink;
  
  /// The latest link received by the app
  String? get latestLink => _latestLink;

  /// Function to call when a checkout success link is received
  Function(String sessionId)? onCheckoutSuccess;
  
  /// Function to call when a checkout cancel link is received
  Function()? onCheckoutCancel;

  /// Initialize the deep link service
  Future<void> init() async {
    if (_initialized) return;
    
    // Handle case where app is started from deep link
    try {
      final initialLink = await getInitialLink();
      if (initialLink != null) {
        _initialLink = initialLink;
        _processIncomingLink(initialLink);
      }
    } on PlatformException {
      // Handle exception if getInitialLink fails
      debugPrint('Failed to get initial link');
    }

    // Handle links received when app is already running
    try {
      _linkSubscription = linkStream.listen((String? link) {
        if (link != null) {
          _latestLink = link;
          _processIncomingLink(link);
        }
      }, onError: (error) {
        debugPrint('Deep link subscription error: $error');
      });
    } on PlatformException {
      debugPrint('Failed to subscribe to incoming links');
    }

    _initialized = true;
  }

  /// Process an incoming deep link
  void _processIncomingLink(String link) {
    debugPrint('Processing deep link: $link');
    
    try {
      final uri = Uri.parse(link);
      
      // Extract parameters from query string
      final queryParams = uri.queryParameters;
      final sessionId = queryParams['session_id'];
      
      if (uri.host == 'checkout-success' && sessionId != null) {
        debugPrint('Received checkout success with session ID: $sessionId');
        onCheckoutSuccess?.call(sessionId);
      } else if (uri.host == 'checkout-cancel') {
        debugPrint('Received checkout cancel');
        onCheckoutCancel?.call();
      } else {
        debugPrint('Unhandled deep link: $link');
      }
    } catch (e) {
      debugPrint('Error processing deep link: $e');
    }
  }

  /// Dispose resources
  @override
  void dispose() {
    _linkSubscription?.cancel();
    super.dispose();
  }
}