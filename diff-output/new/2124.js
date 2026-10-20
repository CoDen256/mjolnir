__d(function (g, _r, _i, a, m, _e, d) {
  var e = _r(d[0]);
  Object.defineProperty(_e, "__esModule", {
    value: !0
  }), _e.default = void 0;
  var t = e(_r(d[1])),
    r = e(_r(d[2])),
    n = e(_r(d[3])),
    o = A(_r(d[4])),
    u = _r(d[5]),
    i = _r(d[6]),
    s = _r(d[7]),
    l = A(_r(d[8])),
    c = e(_r(d[9])),
    f = _r(d[10]),
    p = _r(d[11]),
    h = e(_r(d[12])),
    C = _r(d[13]),
    v = e(_r(d[14])),
    y = e(_r(d[15])),
    w = e(_r(d[16])),
    x = e(_r(d[17])),
    T = e(_r(d[18])),
    k = e(_r(d[19])),
    S = e(_r(d[20])),
    b = e(_r(d[21])),
    j = e(_r(d[22])),
    I = e(_r(d[23])),
    D = _r(d[24]),
    P = _r(d[25]),
    _ = e(_r(d[26])),
    R = e(_r(d[27])),
    z = _r(d[28]);
  function A(e, t) {
    if ("function" == typeof WeakMap) var r = new WeakMap(),
      n = new WeakMap();
    return (A = function (e, t) {
      if (!t && e && e.__esModule) return e;
      var o,
        u,
        i = {
          __proto__: null,
          default: e
        };
      if (null === e || "object" != typeof e && "function" != typeof e) return i;
      if (o = t ? n : r) {
        if (o.has(e)) return o.get(e);
        o.set(e, i);
      }
      for (var s in e) "default" !== s && {}.hasOwnProperty.call(e, s) && ((u = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, s)) && (u.get || u.set) ? o(i, s, u) : i[s] = e[s]);
      return i;
    })(e, t);
  }
  var N = i.Dimensions.get('window').height,
    O = {
      fullWidth: !0,
      onlySmall: !1,
      showCloseButton: !1,
      closeOnTouchOutside: !0,
      noBar: !1,
      style: {
        zIndex: 9999
      }
    },
    L = p.renderers.Popover,
    E = function (e) {
      return v.default.setType(e), i.StyleSheet.create({
        title: {
          fontSize: (0, C.normalize)(24),
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
          backgroundColor: v.default.getTheme().background,
          shadowColor: v.default.getTheme().tooltipShadowColor,
          shadowOffset: {
            width: -4,
            height: -4
          },
          shadowOpacity: .2,
          shadowRadius: 3,
          zIndex: 9
        },
        tooltipContent: {
          backgroundColor: v.default.getTheme().background,
          borderRadius: (0, C.normalize)(8),
          padding: (0, C.normalize)(10),
          shadowColor: v.default.getTheme().tooltipShadowColor,
          shadowOffset: {
            width: 2,
            height: 2
          },
          shadowOpacity: 1,
          shadowRadius: 3
        },
        tooltipText: Object.assign({}, y.default.smallText, {
          color: v.default.getTheme().heading,
          textAlign: 'center'
        })
      });
    };
  _e.default = (0, u.connect)(function (e) {
    return {
      mode: e.settings.theme,
      currentId: e.deckStats.current_id,
      currentSession: e.deckStats.current_session,
      currentToGraduate: e.deckStats.current_to_graduate,
      prevSession: e.deckStats.prev_session,
      prevId: e.deckStats.prev_id,
      prevToGraduate: e.deckStats.prev_to_graduate,
      firstCardArchived: e.deckStats.first_card_archived,
      totalCards: e.deckStats.total_cards,
      gameDecks: e.deckStats.game_decks,
      decksInfo: e.deckStats.decks_info,
      lastDeckPulled: e.deckStats.last_deck_pulled,
      newCounter: e.deckStats.new_counter,
      reviewedCounter: e.deckStats.reviewed_counter,
      completedCounter: e.deckStats.completed_counter,
      prevNewCounter: e.deckStats.prev_new_counter,
      prevReviewedCounter: e.deckStats.prev_reviewed_counter,
      prevCompletedCounter: e.deckStats.prev_completed_counter,
      lastInjectionDay: e.deckStats.last_injection_day,
      cardsPurchased: e.deckStats.cards_purchased,
      completedSessions: e.deckStats.completed_sessions
    };
  }, function (e) {
    return {
      visitStudyCards: function (t) {
        return e((0, D.visitStudyCards)(t));
      },
      setCurrentSession: function (t) {
        return e((0, D.setCurrentSession)(t));
      },
      setCurrentId: function (t) {
        return e((0, D.setCurrentId)(t));
      },
      setCurrentToGraduate: function (t) {
        return e((0, D.setCurrentToGraduate)(t));
      },
      setFirstCardArchived: function (t) {
        return e((0, D.setFirstCardArchived)(t));
      },
      setTotalCards: function (t) {
        return e((0, D.setTotalCards)(t));
      },
      setDecksInfo: function (t) {
        return e((0, D.setDecksInfo)(t));
      },
      setLastDeckPulled: function (t) {
        return e((0, D.setLastDeckPulled)(t));
      },
      setNewCounter: function (t) {
        return e((0, D.setNewCounter)(t));
      },
      setReviewedCounter: function (t) {
        return e((0, D.setReviewedCounter)(t));
      },
      setCompletedCounter: function (t) {
        return e((0, D.setCompletedCounter)(t));
      },
      setPrevNewCounter: function (t) {
        return e((0, D.setPrevNewCounter)(t));
      },
      setPrevReviewedCounter: function (t) {
        return e((0, D.setPrevReviewedCounter)(t));
      },
      setPrevCompletedCounter: function (t) {
        return e((0, D.setPrevCompletedCounter)(t));
      },
      setLastInjectionDay: function (t) {
        return e((0, D.setLastInjectionDay)(t));
      }
    };
  })(function (e) {
    var u = e.navigation,
      D = e.mode,
      A = e.currentId,
      F = e.setCurrentSession,
      M = e.setCurrentId,
      H = e.setCurrentToGraduate,
      V = e.prevSession,
      G = e.prevId,
      B = e.prevToGraduate,
      W = e.totalCards,
      K = e.setTotalCards,
      U = e.gameDecks,
      X = e.lastDeckPulled,
      Y = e.decksInfo,
      q = e.setDecksInfo,
      J = e.setLastDeckPulled,
      Q = e.newCounter,
      Z = e.reviewedCounter,
      $ = e.completedCounter,
      ee = e.prevNewCounter,
      te = e.prevReviewedCounter,
      re = e.prevCompletedCounter,
      ne = e.setNewCounter,
      oe = e.setReviewedCounter,
      ae = e.setCompletedCounter,
      ue = e.lastInjectionDay,
      ie = e.setLastInjectionDay,
      se = e.cardsPurchased,
      de = e.completedSessions,
      le = (0, P.useRoute)().params || {},
      ce = le.sessionCards,
      fe = le.toGraduate,
      pe = E(D),
      he = (0, o.useRef)(A),
      ge = (0, o.useState)(!1),
      me = (0, n.default)(ge, 2),
      Ce = me[0],
      ve = me[1],
      ye = (0, o.useState)(15),
      we = (0, n.default)(ye, 2),
      xe = we[0],
      Te = we[1],
      ke = (0, o.useRef)(15),
      Se = (0, o.useState)({}),
      be = (0, n.default)(Se, 2),
      je = be[0],
      Ie = be[1],
      De = (0, o.useState)(!1),
      Pe = (0, n.default)(De, 2),
      Re = Pe[0],
      ze = Pe[1],
      Ae = (0, o.useState)(!1),
      Ne = (0, n.default)(Ae, 2),
      Oe = Ne[0],
      Le = Ne[1],
      Ee = (0, o.useState)(!1),
      Fe = (0, n.default)(Ee, 2),
      Me = Fe[0],
      He = Fe[1],
      Ve = (0, o.useRef)(!1),
      Ge = (0, o.useRef)(0),
      Be = (0, o.useRef)([]),
      We = (0, o.useRef)(Q),
      Ke = (0, o.useRef)(Z),
      Ue = (0, o.useRef)($),
      Xe = (0, o.useRef)(ee),
      Ye = (0, o.useRef)(te),
      qe = (0, o.useRef)(re),
      Je = (0, o.useRef)(1),
      Qe = (0, o.useRef)(-1),
      Ze = (0, o.useState)(!1),
      $e = (0, n.default)(Ze, 2),
      et = $e[0],
      tt = $e[1],
      rt = (0, o.useRef)(0),
      nt = (0, o.useState)({}),
      ot = (0, n.default)(nt, 2),
      at = ot[0],
      ut = ot[1],
      it = (0, o.useRef)(fe),
      st = (0, o.useCallback)(function () {
        return ce.filter(function (e) {
          return 'brand' === e.Type;
        }).length;
      }, [A]),
      dt = (0, o.useCallback)(function () {
        return ce.filter(function (e) {
          return 'same' === e.Type && !1 === e.Postponed;
        }).length;
      }, [A]),
      lt = (0, o.useCallback)(function () {
        return ce.filter(function (e) {
          return 'prev' === e.Type && !1 === e.Postponed;
        }).length;
      }, [A]);
    (0, o.useEffect)(function () {
      var e = c.default.addEventListener('FinishedLoading', function () {}),
        t = c.default.addEventListener('FinishedLoadingFile', function () {}),
        r = c.default.addEventListener('FinishedPlaying', function () {});
      return function () {
        e.remove(), t.remove(), r.remove();
      };
    }, []);
    var ct,
      ft,
      pt = (ct = he.current, ft = (0, o.useRef)(), (0, o.useEffect)(function () {
        ft.current = ct;
      }), ft.current);
    (0, o.useEffect)(function () {
      c.default.pause(), void 0 !== pt && je[pt] && (clearTimeout(je[pt]), Ie(Object.assign({}, je, (0, r.default)({}, pt, null)))), vt(he.current);
    }, [rt.current]);
    var ht = function () {
        var e;
        if (st() <= 4 && dt() <= 5 && lt() <= 15) {
          if (e = (0, h.default)().subtract(4, 'hours').toDate().toLocaleDateString(), ue === e || (ie(ue = e), 0)) return Je.current = 1, Le(!0), Tt(), !1;
          He(!0);
        } else Je.current = 1, Le(!0), Tt();
      },
      gt = function (e) {
        if ('B12001' !== e) try {
          var t = e.toLowerCase();
          c.default.pause(), c.default.playSoundFile(t, 'mp3');
        } catch (e) {
          i.Alert.alert('No Audio', 'Unfortunately, there is no audio available for this card.');
        }
      },
      mt = function (e) {
        if ('N' === e.A) return e.language;
        if ('E' === e.A) {
          if ('N' === e.language) return 'E';
          if ('E' === e.language) return 'N';
        } else if ('X' === e.A) return 'X';
      },
      Ct = [],
      vt = function (e, t) {
        try {
          var r = ce[e];
          if ('B12001' === r.ID) return;
          var n = mt(r),
            o = Ct.some(function (e) {
              return e.id === r.ID.toLowerCase() && e.time === r.Time;
            });
          ('B01' === r.DECK_ID && 'brand' === r.Type || !o && (!t && ('A' === n || 'N' === n) || t && ('E' === n || 'X' === n))) && (c.default.pause(), c.default.playSoundFile(r.ID.toLowerCase(), 'mp3'), t && Ct.push({
            id: r.ID.toLowerCase(),
            time: r.Time
          }));
        } catch (e) {}
      },
      yt = function (e) {
        'inc' === e && xe < 22 ? (Te(xe + 1), ke.current++) : 'dec' === e && xe > 10 && (Te(xe - 1), ke.current--);
      },
      wt = function () {
        var e = _.default.drawNewCards(U, 5, X, Y, W, se);
        X = e.lastDeckPulled, Y = e.decksInfo, W = e.totalCards, Be.current = e.userDeckTmp;
        var r = [],
          n = function (e) {
            var t = W.find(function (t) {
              return t.ID === e.card.slice(0, 6) && t.language === e.card.substr(e.card.length - 1) && t.DECK_ID === e.deck;
            });
            t.Stage = 0, t.Graduated = !1, t.Type = 'brand', t.Postponed = !1, t.Time = new Date().getTime(), t.CF = 0, t.AutoParkHit = 0, t.AutoTagHit = 0, it.current.current++, r.push(t);
          };
        for (var o of e.userDeckTmp) n(o);
        ce.push.apply(ce, r), J(X), q((0, t.default)(Y)), K((0, t.default)(W)), Ge.current++;
      };
    (0, o.useEffect)(function () {
      xt(!0);
    }, [xe]);
    var xt = function () {
        var e = {
          fontUpdate: arguments.length > 0 && void 0 !== arguments[0] && arguments[0],
          currentItem: Object.assign({}, ce[he.current]),
          currentCard: (0, z.jsx)(T.default, {
            index: he.current,
            item: ce[he.current],
            onNext: ht,
            withoutVeil: ('filler' === ce[he.current].Type || 'brand' === ce[he.current].Type) && 'A' !== ce[he.current].language,
            soundPlay: vt,
            promptSoundPlay: function () {
              return gt(ce[he.current].ID);
            },
            fontSize: ke.current,
            park: !0,
            injections: Ge,
            popupVeilShowed: Ve,
            lastCardsInjected: Be,
            ToGraduate: it,
            newCounter: We,
            reviewedCounter: Ke,
            completedCounter: Ue,
            prevNewCounter: Xe,
            prevReviewedCounter: Ye,
            prevCompletedCounter: qe,
            indexCarousel: rt.current,
            lastIndex: Qe
          }, he.current)
        };
        Qe && Qe.current >= 0 && (e.prevItem = Object.assign({}, ce[Qe.current]), e.prevCard = (0, z.jsx)(T.default, {
          index: Qe.current,
          item: ce[Qe.current],
          onNext: ht,
          withoutVeil: !0,
          soundPlay: vt,
          promptSoundPlay: function () {
            return gt(ce[Qe.current].ID);
          },
          fontSize: ke.current,
          park: !1,
          injections: Ge,
          popupVeilShowed: !0,
          lastCardsInjected: Be,
          ToGraduate: it,
          newCounter: We,
          reviewedCounter: Ke,
          completedCounter: Ue,
          prevNewCounter: Xe,
          prevReviewedCounter: Ye,
          prevCompletedCounter: qe,
          indexCarousel: Qe,
          lastIndex: rt.current
        }, Qe.current)), ut(e);
      },
      Tt = function () {
        for (var e = 0; e < ce.length; e++) if (!ce[e].Postponed) {
          rt.current++, he.current = e, M(e), setTimeout(function () {
            return xt(!1);
          }, 150);
          break;
        }
      },
      kt = 2 === rt.current && de <= 2;
    return (0, z.jsxs)(s.SafeAreaView, {
      style: {
        flex: 1,
        backgroundColor: v.default.getTheme().background
      },
      edges: ['top', 'bottom'],
      children: [(0, z.jsxs)(i.View, {
        style: [y.default.header, {
          justifyContent: 'space-between'
        }],
        children: [(0, z.jsx)(x.default, {
          onPress: function () {
            return ze(!0);
          }
        }), (0, z.jsxs)(i.View, {
          style: [pe.flex],
          children: [(0, z.jsxs)(p.Menu, {
            renderer: L,
            rendererProps: {
              preferredPlacement: 'bottom',
              anchorStyle: pe.tooltipAnchor
            },
            children: [(0, z.jsx)(p.MenuTrigger, {
              customStyles: {
                triggerTouchable: {
                  underlayColor: 'none',
                  background: i.TouchableNativeFeedback.Ripple(v.default.getTheme().background, !1)
                }
              },
              children: (0, z.jsxs)(i.View, {
                style: [pe.flex, {
                  flexDirection: 'column',
                  paddingHorizontal: (0, C.normalize)(10),
                  marginHorizontal: (0, C.normalize)(10)
                }],
                children: [v.default.getTheme().light, (0, z.jsx)(i.Text, {
                  style: [y.default.headerText, {
                    color: v.default.getTheme().studyCardHeading,
                    marginTop: (0, C.normalize)(4)
                  }],
                  children: st()
                })]
              })
            }), (0, z.jsx)(p.MenuOptions, {
              optionsContainerStyle: pe.tooltipContent,
              children: (0, z.jsx)(i.Text, {
                style: pe.tooltipText,
                children: 'New cards yet to\nbe seen today'
              })
            })]
          }), (0, z.jsxs)(p.Menu, {
            renderer: L,
            rendererProps: {
              preferredPlacement: 'bottom',
              anchorStyle: pe.tooltipAnchor
            },
            children: [(0, z.jsx)(p.MenuTrigger, {
              customStyles: {
                triggerTouchable: {
                  underlayColor: 'none',
                  background: i.TouchableNativeFeedback.Ripple(v.default.getTheme().background, !1)
                }
              },
              children: (0, z.jsxs)(i.View, {
                style: [pe.flex, {
                  flexDirection: 'column',
                  paddingHorizontal: (0, C.normalize)(10),
                  marginHorizontal: (0, C.normalize)(10)
                }],
                children: [v.default.getTheme().clock, (0, z.jsx)(i.Text, {
                  style: [y.default.headerText, {
                    color: v.default.getTheme().studyCardHeading,
                    marginTop: (0, C.normalize)(4)
                  }],
                  children: dt()
                })]
              })
            }), (0, z.jsx)(p.MenuOptions, {
              optionsContainerStyle: pe.tooltipContent,
              children: (0, z.jsx)(i.Text, {
                style: pe.tooltipText,
                children: 'Cards to be seen\nat least once\nmore today'
              })
            })]
          }), (0, z.jsxs)(p.Menu, {
            renderer: L,
            rendererProps: {
              preferredPlacement: 'bottom',
              anchorStyle: pe.tooltipAnchor
            },
            children: [(0, z.jsx)(p.MenuTrigger, {
              customStyles: {
                triggerTouchable: {
                  underlayColor: 'none',
                  background: i.TouchableNativeFeedback.Ripple(v.default.getTheme().background, !1)
                }
              },
              children: (0, z.jsxs)(i.View, {
                style: [pe.flex, {
                  flexDirection: 'column',
                  paddingHorizontal: (0, C.normalize)(10),
                  marginHorizontal: (0, C.normalize)(10)
                }],
                children: [v.default.getTheme().calendar, (0, z.jsx)(i.Text, {
                  style: [y.default.headerText, {
                    color: v.default.getTheme().studyCardHeading,
                    marginTop: (0, C.normalize)(4)
                  }],
                  children: lt()
                })]
              })
            }), (0, z.jsx)(p.MenuOptions, {
              optionsContainerStyle: pe.tooltipContent,
              children: (0, z.jsx)(i.Text, {
                style: pe.tooltipText,
                children: 'Cards from\nprevious days to be\nreviewed today'
              })
            })]
          })]
        }), (0, z.jsx)(w.default, {
          hightlight: kt,
          onPress: function () {
            ze(!1), new i.NativeEventEmitter('MjolnirModule').emit('parkCard', ce[A].DECK_ID + '_' + ce[A].ID + ce[A].language), et || ve(!0);
          }
        })]
      }), (0, z.jsx)(R.default, {
        data: at,
        direction: Je.current
      }), (0, z.jsx)(f.SwipeablePanel, Object.assign({}, O, {
        isActive: Re,
        onClose: function () {
          return ze(!1);
        },
        smallPanelHeight: N / 1.6,
        style: {
          backgroundColor: v.default.getTheme().vailBackground
        },
        children: (0, z.jsx)(j.default, {
          increaseFontSize: function () {
            return yt('inc');
          },
          decreaseFontSize: function () {
            return yt('dec');
          },
          undoLastScheduling: function () {
            if (rt.current) {
              if (Oe) {
                Je.current = -1;
                var e = Object.assign({}, ce[A]);
                if (Qe.current = V.findIndex(function (t) {
                  return t.ID === e.ID && t.language === e.language;
                }), ce.splice(0, ce.length), ce.push.apply(ce, (0, t.default)(V)), A = G, F(ce), M(A), H(B), fe.current = B, We.current = Xe.current, Ke.current = Ye.current, Ue.current = qe.current, ne(We.current), oe(Ke.current), ae(Ue.current), Be.current.length > 0) {
                  Ge.current--;
                  var r = _.default.undoLastDraw(U, Be.current, X, Y, W);
                  X = r.lastDeckPulled, Y = r.decksInfo, W = r.totalCards, J(X), q(Y), K(W), Be.current = [];
                }
                Tt(), Le(!1), ze(!1);
              }
            } else u.goBack();
          }
        })
      })), (0, z.jsx)(b.default, {
        isActive: Me,
        onClose: function () {
          He(!1), Le(!0);
        },
        icon: v.default.getTheme().loading,
        title: 'Would you like\nmore new cards?',
        description: "You are approaching the end of today's session. If you want to study more, you could add some new cards. However, this might mean you'll have more reviews in the next days. Add 5 new cards?",
        buttons: (0, z.jsxs)(z.Fragment, {
          children: [(0, z.jsx)(S.default, {
            title: 'Yes',
            styles: {
              marginRight: (0, C.normalize)(24)
            },
            onPress: function () {
              wt(), He(!1), Tt();
            }
          }), (0, z.jsx)(S.default, {
            title: 'No',
            onPress: function () {
              He(!1), Tt();
            }
          })]
        }),
        buttonAnimation: !0
      }), (0, z.jsx)(b.default, {
        isActive: Ce,
        onClose: function () {
          ve(!1), tt(!0);
        },
        allowTouchOutside: !1,
        title: "Flashcard archived!",
        icon: (0, z.jsx)(I.default, {
          width: (0, C.normalize)(64),
          height: (0, C.normalize)(64)
        }),
        leftAlignDescription: !0,
        description: 'The next card is your only chance to unarchive this card, using the \u22ef menu to Undo (top left corner). After that, you will not be able to see the archived flashcard again, nor to un-archive it.',
        buttons: de < 2 ? (0, z.jsx)(l.View, {
          animation: 'fadeIn',
          duration: 500,
          delay: 4e3,
          children: (0, z.jsx)(k.default, {
            title: "I understand",
            color: v.default.getTheme().buttonColor1,
            paddingHorizontal: (0, C.normalize)(64),
            onPress: function () {
              ve(!1), tt(!0);
            }
          })
        }) : (0, z.jsx)(k.default, {
          title: "I understand",
          color: v.default.getTheme().buttonColor1,
          paddingHorizontal: (0, C.normalize)(64),
          onPress: function () {
            ve(!1), tt(!0);
          }
        })
      })]
    });
  });
}, 2124, [1, 11, 99, 56, 77, 892, 5, 944, 1414, 1440, 2125, 926, 1219, 1243, 1252, 1406, 2129, 2130, 2131, 1407, 2134, 2135, 2136, 2137, 1408, 990, 2110, 2138, 80]);