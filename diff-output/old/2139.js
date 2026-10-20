__d(function (g, _r, _i, a, m, _e, d) {
  var e = _r(d[0]);
  Object.defineProperty(_e, "__esModule", {
    value: !0
  }), _e.default = void 0;
  var t = e(_r(d[1])),
    n = e(_r(d[2])),
    r = function (e, t) {
      if ("function" == typeof WeakMap) var n = new WeakMap(),
        r = new WeakMap();
      return function (e, t) {
        if (!t && e && e.__esModule) return e;
        var o,
          i,
          l = {
            __proto__: null,
            default: e
          };
        if (null === e || "object" != typeof e && "function" != typeof e) return l;
        if (o = t ? r : n) {
          if (o.has(e)) return o.get(e);
          o.set(e, l);
        }
        for (var u in e) "default" !== u && {}.hasOwnProperty.call(e, u) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, u)) && (i.get || i.set) ? o(l, u, i) : l[u] = e[u]);
        return l;
      }(e, t);
    }(_r(d[3])),
    o = _r(d[4]),
    i = _r(d[5]),
    l = _r(d[6]),
    u = e(_r(d[7])),
    s = e(_r(d[8])),
    c = _r(d[9]),
    f = _r(d[10]),
    h = e(_r(d[11])),
    p = e(_r(d[12])),
    x = e(_r(d[13])),
    y = e(_r(d[14])),
    T = e(_r(d[15])),
    b = e(_r(d[16])),
    v = e(_r(d[17])),
    j = e(_r(d[18])),
    C = e(_r(d[19])),
    w = _r(d[20]),
    S = _r(d[21]),
    k = _r(d[22]),
    z = _r(d[23]);
  var P = [4, 7],
    O = k.renderers.Popover,
    M = function (e) {
      return h.default.setType(e), i.StyleSheet.create({
        title: {
          fontSize: (0, f.normalize)(24),
          color: '#fff'
        },
        slide: {
          flex: 1,
          alignItems: 'center'
        },
        flex: {
          flexDirection: 'row',
          alignItems: 'center'
        },
        tooltipAnchor: {
          backgroundColor: h.default.getTheme().background,
          shadowColor: h.default.getTheme().tooltipShadowColor,
          shadowOffset: {
            width: -4,
            height: -4
          },
          shadowOpacity: .2,
          shadowRadius: 3,
          zIndex: 9
        },
        tooltipContent: {
          backgroundColor: h.default.getTheme().background,
          borderRadius: (0, f.normalize)(8),
          padding: (0, f.normalize)(10),
          shadowColor: h.default.getTheme().tooltipShadowColor,
          shadowOffset: {
            width: 2,
            height: 2
          },
          shadowOpacity: 1,
          shadowRadius: 3
        },
        tooltipText: Object.assign({}, p.default.smallText, {
          color: h.default.getTheme().heading,
          textAlign: 'center'
        })
      });
    };
  _e.default = (0, o.connect)(function (e) {
    return {
      mode: e.settings.theme,
      visited: e.deckStats.visited_study_cards,
      currentId: e.deckStats.current_id
    };
  }, function (e) {
    return {
      visitStudyCards: function (t) {
        return e((0, w.visitStudyCards)(t));
      }
    };
  })(function (e) {
    var o = e.navigation,
      w = e.mode,
      _ = e.currentId,
      F = ((0, S.useRoute)().params || {}).sessionCards,
      H = M(w),
      I = (0, r.useRef)(),
      A = (0, r.useState)(_),
      R = (0, n.default)(A, 2),
      V = R[0],
      N = R[1],
      E = (0, r.useState)(!1),
      L = (0, n.default)(E, 2),
      W = L[0],
      D = L[1],
      B = (0, r.useState)(15),
      G = (0, n.default)(B, 2),
      J = G[0],
      U = G[1],
      q = (0, r.useState)(!1),
      K = (0, n.default)(q, 2),
      Q = K[0],
      X = K[1],
      Y = (0, r.useState)(!1),
      Z = (0, n.default)(Y, 2),
      $ = Z[0],
      ee = Z[1],
      te = (0, r.useCallback)(function () {
        return F.filter(function (e) {
          return 'brand' == e.Type;
        }).length;
      }, [_]),
      ne = (0, r.useCallback)(function () {
        return F.filter(function (e) {
          return 'same' == e.Type && 0 == e.Postponed;
        }).length;
      }, [_]),
      re = (0, r.useCallback)(function () {
        return F.filter(function (e) {
          return 'prev' == e.Type && 0 == e.Postponed;
        }).length;
      }, [_]),
      oe = {
        fullWidth: !0,
        onlySmall: !0,
        showCloseButton: !1,
        closeOnTouchOutside: !0,
        noBar: !1,
        style: {
          zIndex: 9999
        },
        onClose: function () {
          return X(!1);
        }
      };
    (0, r.useEffect)(function () {
      var e = s.default.addEventListener('FinishedLoading', function () {}),
        t = s.default.addEventListener('FinishedLoadingFile', function () {}),
        n = s.default.addEventListener('FinishedPlaying', function () {});
      return function () {
        e.remove(), t.remove(), n.remove();
      };
    }, []), (0, r.useEffect)(function () {
      s.default.pause(), ae(V);
    }, [V]);
    var ae = function () {
        var e = (0, t.default)(function* (e, t) {
          P.indexOf(e);
        });
        return function (t, n) {
          return e.apply(this, arguments);
        };
      }(),
      ie = function (e) {
        'inc' === e && J < 17 ? U(J + 1) : 'dec' === e && J > 10 && U(J - 1);
      },
      le = (0, r.useCallback)(function () {
        return F.map(function (e, t) {
          return (0, z.jsx)(T.default, {
            index: t,
            item: e,
            onNext: function () {
              var e;
              null == (e = I.current) || e.snapToNext(), ee(!0);
            },
            withoutVeil: !1,
            soundPlay: ae,
            promptSoundPlay: function () {
              s.default.pause();
            },
            fontSize: J
          }, t);
        });
      }, [F]),
      de = (0, r.useCallback)(function (e) {
        var t = e.item,
          n = e.index;
        return (0, z.jsx)(i.View, {
          style: H.slide,
          children: t
        }, n);
      }, [H.slide]);
    return (0, z.jsxs)(l.SafeAreaView, {
      style: {
        flex: 1,
        backgroundColor: h.default.getTheme().background
      },
      edges: ['top'],
      children: [(0, z.jsxs)(i.View, {
        style: [p.default.header, {
          justifyContent: 'space-between'
        }],
        children: [(0, z.jsx)(y.default, {
          onPress: function () {
            return X(!0);
          }
        }), (0, z.jsxs)(i.View, {
          style: [H.flex],
          children: [(0, z.jsxs)(k.Menu, {
            renderer: O,
            rendererProps: {
              preferredPlacement: 'bottom',
              anchorStyle: H.tooltipAnchor
            },
            children: [(0, z.jsx)(k.MenuTrigger, {
              customStyles: {
                triggerTouchable: {
                  underlayColor: 'none',
                  background: i.TouchableNativeFeedback.Ripple(h.default.getTheme().background, !1)
                }
              },
              children: (0, z.jsxs)(i.View, {
                style: [H.flex, {
                  flexDirection: 'column',
                  paddingHorizontal: (0, f.normalize)(10),
                  marginHorizontal: (0, f.normalize)(10)
                }],
                children: [h.default.getTheme().light, (0, z.jsx)(i.Text, {
                  style: [p.default.headerText, {
                    color: h.default.getTheme().studyCardHeading,
                    marginTop: (0, f.normalize)(4)
                  }],
                  children: te()
                })]
              })
            }), (0, z.jsx)(k.MenuOptions, {
              optionsContainerStyle: H.tooltipContent,
              children: (0, z.jsx)(i.Text, {
                style: H.tooltipText,
                children: 'New cards yet to\nbe seen today'
              })
            })]
          }), (0, z.jsxs)(k.Menu, {
            renderer: O,
            rendererProps: {
              preferredPlacement: 'bottom',
              anchorStyle: H.tooltipAnchor
            },
            children: [(0, z.jsx)(k.MenuTrigger, {
              customStyles: {
                triggerTouchable: {
                  underlayColor: 'none',
                  background: i.TouchableNativeFeedback.Ripple(h.default.getTheme().background, !1)
                }
              },
              children: (0, z.jsxs)(i.View, {
                style: [H.flex, {
                  flexDirection: 'column',
                  paddingHorizontal: (0, f.normalize)(10),
                  marginHorizontal: (0, f.normalize)(10)
                }],
                children: [h.default.getTheme().clock, (0, z.jsx)(i.Text, {
                  style: [p.default.headerText, {
                    color: h.default.getTheme().studyCardHeading,
                    marginTop: (0, f.normalize)(4)
                  }],
                  children: ne()
                })]
              })
            }), (0, z.jsx)(k.MenuOptions, {
              optionsContainerStyle: H.tooltipContent,
              children: (0, z.jsx)(i.Text, {
                style: H.tooltipText,
                children: 'Cards to be seen\nat least once\nmore today'
              })
            })]
          }), (0, z.jsxs)(k.Menu, {
            renderer: O,
            rendererProps: {
              preferredPlacement: 'bottom',
              anchorStyle: H.tooltipAnchor
            },
            children: [(0, z.jsx)(k.MenuTrigger, {
              customStyles: {
                triggerTouchable: {
                  underlayColor: 'none',
                  background: i.TouchableNativeFeedback.Ripple(h.default.getTheme().background, !1)
                }
              },
              children: (0, z.jsxs)(i.View, {
                style: [H.flex, {
                  flexDirection: 'column',
                  paddingHorizontal: (0, f.normalize)(10),
                  marginHorizontal: (0, f.normalize)(10)
                }],
                children: [h.default.getTheme().calendar, (0, z.jsx)(i.Text, {
                  style: [p.default.headerText, {
                    color: h.default.getTheme().studyCardHeading,
                    marginTop: (0, f.normalize)(4)
                  }],
                  children: re()
                })]
              })
            }), (0, z.jsx)(k.MenuOptions, {
              optionsContainerStyle: H.tooltipContent,
              children: (0, z.jsx)(i.Text, {
                style: H.tooltipText,
                children: 'Cards from\nprevious days to be\nreviewed today'
              })
            })]
          })]
        }), (0, z.jsx)(x.default, {
          onPress: function () {
            return D(!0);
          }
        })]
      }), (0, z.jsx)(u.default, {
        ref: I,
        data: le(),
        renderItem: de,
        scrollEnabled: !1,
        enableSnap: !1,
        sliderWidth: f.width,
        itemWidth: f.width,
        onSnapToItem: N,
        useScrollView: !0,
        initialNumToRender: V,
        firstItem: V
      }), (0, z.jsx)(c.SwipeablePanel, Object.assign({}, oe, {
        isActive: Q,
        style: {
          backgroundColor: h.default.getTheme().vailBackground
        },
        children: (0, z.jsx)(j.default, {
          increaseFontSize: function () {
            return ie('inc');
          },
          decreaseFontSize: function () {
            return ie('dec');
          },
          undoLastScheduling: function () {
            V ? $ && X(!1) : o.goBack();
          }
        })
      })), (0, z.jsx)(v.default, {
        isActive: W,
        onClose: function () {
          return D(!1);
        },
        title: 'Flashcard archived!',
        icon: (0, z.jsx)(C.default, {
          width: (0, f.normalize)(64),
          height: (0, f.normalize)(64)
        }),
        description: 'The next card is your only chance to unarchive this card, using the \u22ef menu to Undo (top left corner). After that, you will not be able to see the archived flashcard again, nor to un-archive it.',
        buttons: (0, z.jsx)(b.default, {
          title: "I understand",
          color: h.default.getTheme().buttonColor1,
          paddingHorizontal: (0, f.normalize)(64),
          onPress: function () {
            var e;
            (D(!1), V !== F.length - 1) ? null == (e = I.current) || e.snapToNext() : (s.default.pause(), o.navigate('GreatJob'));
          }
        })
      })]
    });
  });
}, 2139, [1, 68, 56, 77, 892, 5, 944, 2014, 1440, 2125, 1243, 1252, 1406, 2129, 2130, 2131, 1407, 2135, 2136, 2137, 1408, 990, 926, 80]);