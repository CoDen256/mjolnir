__d(function (g, _r, _i, a, m, _e, d) {
  var e = _r(d[0]);
  Object.defineProperty(_e, "__esModule", {
    value: !0
  }), _e.default = void 0;
  var t = e(_r(d[1])),
    n = e(_r(d[2])),
    o = e(_r(d[3])),
    i = j(_r(d[4])),
    r = _r(d[5]),
    l = _r(d[6]),
    s = j(_r(d[7])),
    c = e(_r(d[8])),
    u = j(_r(d[9])),
    f = _r(d[10]),
    h = e(_r(d[11])),
    p = e(_r(d[12])),
    y = _r(d[13]),
    x = e(_r(d[14])),
    b = e(_r(d[15])),
    k = _r(d[16]),
    S = _r(d[17]),
    z = e(_r(d[18])),
    T = e(_r(d[19])),
    v = e(_r(d[20])),
    C = _r(d[21]);
  function j(e, t) {
    if ("function" == typeof WeakMap) var n = new WeakMap(),
      o = new WeakMap();
    return (j = function (e, t) {
      if (!t && e && e.__esModule) return e;
      var i,
        r,
        l = {
          __proto__: null,
          default: e
        };
      if (null === e || "object" != typeof e && "function" != typeof e) return l;
      if (i = t ? o : n) {
        if (i.has(e)) return i.get(e);
        i.set(e, l);
      }
      for (var s in e) "default" !== s && {}.hasOwnProperty.call(e, s) && ((r = (i = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, s)) && (r.get || r.set) ? i(l, s, r) : l[s] = e[s]);
      return l;
    })(e, t);
  }
  var _ = ["a search", "reels\n& ads", "word of\nmouth"],
    w = {
      "a search": ["Direct search for a language app on App Store or Google Play", "AI (ChatGPT, Claude etc)", "Search engine (Google etc)"],
      "reels\n& ads": ["TikTok video / ad", "Instagram / Facebook content (reel, image, ad)", "Reddit ad", "YouTube video / ad"],
      "word of\nmouth": ["Word-of-mouth on social media", "Word-of-mouth in real life"]
    },
    D = function (e) {
      var t = e.label,
        n = e.value,
        o = e.onChange;
      return (0, C.jsxs)(r.TouchableOpacity, {
        style: P.toggleCheck,
        onPress: function () {
          return o(!n);
        },
        activeOpacity: .7,
        children: [(0, C.jsx)(b.default, {
          value: n,
          onValueChange: o,
          style: P.checkbox,
          boxType: "square",
          tintColors: {
            true: c.default.getTheme().buttonColor1,
            false: c.default.getTheme().checkboxBorder
          },
          tintColor: c.default.getTheme().checkboxBorder,
          onTintColor: c.default.getTheme().buttonColor1,
          onFillColor: c.default.getTheme().buttonColor1,
          onCheckColor: '#fff'
        }), (0, C.jsx)(r.Text, {
          style: P.surveyText,
          children: t
        })]
      });
    },
    P = r.StyleSheet.create({
      container: {
        flex: 1
      },
      header: {
        paddingHorizontal: (0, f.normalize)(16),
        paddingTop: 'ios' === r.Platform.OS ? (0, f.normalize)(10) : (0, f.normalize)(16),
        marginBottom: (0, f.normalize)(8)
      },
      scrollView: {
        flex: 1
      },
      scrollContent: {
        paddingHorizontal: (0, f.normalize)(16),
        paddingBottom: (0, f.normalize)(40),
        paddingTop: (0, f.normalize)(10)
      },
      favourText: Object.assign({}, u.default.headline40Text, {
        textAlign: 'center',
        width: '100%',
        lineHeight: void 0
      }),
      titleText: {
        fontSize: (0, f.normalize)(22),
        lineHeight: (0, f.normalize)(28),
        fontFamily: u.Fonts.poppinsSemiBold,
        color: '#fff',
        marginBottom: (0, f.normalize)(32),
        textAlign: 'center',
        paddingHorizontal: (0, f.normalize)(8)
      },
      tabContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: (0, f.normalize)(32),
        paddingHorizontal: (0, f.normalize)(4)
      },
      tabItem: {
        paddingVertical: (0, f.normalize)(14),
        paddingHorizontal: (0, f.normalize)(10),
        borderRadius: (0, f.normalize)(12),
        backgroundColor: 'rgba(255,255,255,0.1)',
        flex: 1,
        marginHorizontal: (0, f.normalize)(4),
        alignItems: 'center',
        justifyContent: 'center'
      },
      activeTabItem: {
        backgroundColor: '#246BFD'
      },
      tabText: {
        fontSize: (0, f.normalize)(16),
        fontFamily: u.Fonts.poppinsBold,
        color: '#fff',
        textAlign: 'center'
      },
      activeTabText: {
        color: '#fff'
      },
      optionsContainer: {
        flex: 1,
        paddingHorizontal: (0, f.normalize)(8)
      },
      toggleCheck: {
        flexDirection: 'row',
        marginBottom: (0, f.normalize)(20),
        alignItems: 'center'
      },
      checkbox: {
        transform: [{
          scaleX: .9
        }, {
          scaleY: .9
        }],
        marginRight: (0, f.normalize)(12)
      },
      surveyText: {
        fontSize: (0, f.normalize)(16),
        lineHeight: (0, f.normalize)(22),
        fontFamily: u.Fonts.poppinsSemiBold,
        color: '#fff',
        flex: 1
      },
      buttonContainer: {
        position: 'absolute',
        bottom: (0, f.normalize)(f.is16 ? 30 : 50),
        alignSelf: 'center',
        width: '100%',
        alignItems: 'center'
      }
    });
  _e.default = (0, y.connect)(function (e) {
    return {
      mode: e.settings.theme,
      totalCards: e.deckStats.total_cards,
      gameDecks: e.deckStats.game_decks,
      lastDeckPulled: e.deckStats.last_deck_pulled,
      restDays: e.settings.rest_days,
      dailyCards: e.settings.daily_cards,
      studySettings: e.settings.study_settings,
      completedSessions: e.deckStats.completed_sessions,
      selectedApproach: e.settings.selected_approach,
      hasSeenMjolnirWay: e.settings.has_seen_mjolnir_way,
      decksInfo: e.deckStats.decks_info
    };
  }, function (e) {
    return {
      setAcquisitionSource: function (t) {
        return e((0, S.setAcquisitionSource)(t));
      },
      setMarketingSurveySeen: function (t) {
        return e((0, S.setMarketingSurveySeen)(t));
      }
    };
  })(function (e) {
    var u = e.navigation,
      y = e.setAcquisitionSource,
      b = e.setMarketingSurveySeen,
      S = e.totalCards,
      j = e.gameDecks,
      I = e.lastDeckPulled,
      M = e.restDays,
      B = e.dailyCards,
      V = e.studySettings,
      A = e.completedSessions,
      H = e.selectedApproach,
      O = e.hasSeenMjolnirWay,
      F = e.decksInfo,
      W = (0, k.useRoute)().params || {},
      q = (W.startingDecks, W.sessionCards, W.toGraduate, W.currentId, W.lDayPull, W.isExistingUser),
      G = (0, i.useState)(null),
      R = (0, o.default)(G, 2),
      U = R[0],
      E = R[1],
      Y = (0, i.useState)(null),
      L = (0, o.default)(Y, 2),
      X = L[0],
      J = L[1],
      K = q ? "What made you interested in trying Mj\xf8lnir initially?" : "Finally, what made you first interested in trying Mj\xf8lnir?",
      N = (0, i.useMemo)(function () {
        var e = {};
        return _.forEach(function (t) {
          e[t] = [].concat((0, n.default)(x.default.shuffle(w[t])), ["Other / don't remember"]);
        }), e;
      }, []),
      Q = function () {
        var e = (0, t.default)(function* () {
          if (U) if (yield (0, z.default)().logEvent('acquisition_source', {
            source: U
          }), y(U), b(!0), q) {
            var e = v.default.getDecksStatus(F);
            yield T.default.updateUserData(S, j, I, M, B, [V.reminder1, V.reminder2], A, e, H, O, U, !0), yield (0, z.default)().setUserProperty('acquisition_source', U), u.navigate('TopicsToLearn');
          } else u.navigate('Main');
        });
        return function () {
          return e.apply(this, arguments);
        };
      }(),
      Z = X ? N[X] : [],
      $ = function (e) {
        J(e), E(null);
      };
    return (0, C.jsx)(l.SafeAreaView, {
      style: {
        flex: 1,
        backgroundColor: c.default.getTheme().backgroundBlue
      },
      children: (0, C.jsxs)(r.View, {
        style: P.container,
        children: [(0, C.jsxs)(r.View, {
          style: P.header,
          children: [!q && (0, C.jsx)(h.default, {
            onPress: u.goBack
          }), q && (0, C.jsx)(r.Text, {
            style: P.favourText,
            children: "A quick favour"
          })]
        }), (0, C.jsxs)(r.ScrollView, {
          style: P.scrollView,
          contentContainerStyle: P.scrollContent,
          showsVerticalScrollIndicator: !1,
          children: [(0, C.jsx)(r.Text, {
            style: P.titleText,
            children: K
          }), (0, C.jsx)(r.View, {
            style: P.tabContainer,
            children: _.map(function (e) {
              return (0, C.jsx)(r.TouchableOpacity, {
                style: [P.tabItem, X === e && P.activeTabItem],
                onPress: function () {
                  return $(e);
                },
                children: (0, C.jsx)(r.Text, {
                  style: [P.tabText, X === e && P.activeTabText],
                  children: e
                })
              }, e);
            })
          }), X && (0, C.jsx)(r.View, {
            style: P.optionsContainer,
            children: Z.map(function (e, t) {
              return (0, C.jsx)(D, {
                label: e,
                value: U === e,
                onChange: function () {
                  return E(e);
                }
              }, t);
            })
          }), (0, C.jsx)(r.View, {
            style: {
              height: (0, f.normalize)(150)
            }
          })]
        }), U && (0, C.jsx)(s.View, {
          style: P.buttonContainer,
          animation: "fadeInUp",
          duration: 400,
          children: (0, C.jsx)(p.default, {
            title: 'Continue',
            onPress: Q,
            paddingHorizontal: (0, f.normalize)(56)
          })
        })]
      })
    });
  });
}, 2188, [1, 68, 11, 56, 77, 5, 944, 1414, 1252, 1406, 1243, 1435, 1407, 892, 2029, 2120, 990, 1411, 1238, 2080, 2110, 80]);