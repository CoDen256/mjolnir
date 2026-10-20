__d(function (g, _r, _i, _a, m, _e, d) {
  var e = _r(d[0]);
  Object.defineProperty(_e, "__esModule", {
    value: !0
  }), _e.default = void 0;
  var t = e(_r(d[1])),
    n = e(_r(d[2])),
    r = D(_r(d[3])),
    a = _r(d[4]),
    o = _r(d[5]),
    i = _r(d[6]),
    u = D(_r(d[7])),
    s = _r(d[8]),
    l = D(_r(d[9])),
    c = e(_r(d[10])),
    f = _r(d[11]),
    p = e(_r(d[12])),
    h = e(_r(d[13])),
    C = e(_r(d[14])),
    v = e(_r(d[15])),
    y = e(_r(d[16])),
    P = e(_r(d[17])),
    x = e(_r(d[18])),
    T = D(_r(d[19])),
    b = _r(d[20]),
    w = e(_r(d[21])),
    S = e(_r(d[22])),
    F = D(_r(d[23])),
    j = _r(d[24]),
    k = _r(d[25]);
  function D(e, t) {
    if ("function" == typeof WeakMap) var n = new WeakMap(),
      r = new WeakMap();
    return (D = function (e, t) {
      if (!t && e && e.__esModule) return e;
      var a,
        o,
        i = {
          __proto__: null,
          default: e
        };
      if (null === e || "object" != typeof e && "function" != typeof e) return i;
      if (a = t ? r : n) {
        if (a.has(e)) return a.get(e);
        a.set(e, i);
      }
      for (var u in e) "default" !== u && {}.hasOwnProperty.call(e, u) && ((o = (a = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, u)) && (o.get || o.set) ? a(i, u, o) : i[u] = e[u]);
      return i;
    })(e, t);
  }
  var I = function (e) {
      if (-1 === e) return '-1';
      if (e < 60) return e.toString() + ' min' + (e > 1 ? 's' : '');
      var t = e / 60;
      if (t >= 24) {
        var n = t / 24;
        return n.toString() + ' day' + (n > 1 ? 's' : '');
      }
      return t.toString() + 'h';
    },
    z = (0, f.normalize)(260),
    M = (0, f.normalize)(12),
    O = (0, f.normalize)(12),
    E = (0, f.normalize)(92),
    _ = function (e) {
      var t = e.mode,
        a = e.onPress,
        i = e.title,
        s = e.text,
        p = e.icon,
        h = e.withoutVeil,
        C = e.disabled,
        v = e.isFeelPopupShown,
        y = A(t, 0),
        P = (0, r.useState)(v),
        T = (0, n.default)(P, 1)[0];
      return (0, k.jsxs)(x.default, {
        onPress: a,
        style: [l.shadow, y.button, {
          width: h ? '24%' : '32%'
        }],
        disabled: C,
        children: [T && (0, k.jsx)(u.View, {
          style: y.buttonOverlay,
          animation: 'fadeIn',
          delay: 4e3,
          duration: 250
        }), (0, k.jsxs)(o.View, {
          style: y.buttonContent,
          children: [(0, k.jsx)(o.Text, {
            style: [l.default.smallText, {
              color: c.default.getTheme().headingLighter,
              marginTop: (0, f.normalize)(4)
            }],
            children: i
          }), p, (0, k.jsx)(o.Text, {
            style: [l.default.smallText, {
              color: c.default.getTheme().headingLighter,
              marginTop: (0, f.normalize)(4)
            }],
            children: s
          })]
        })]
      });
    },
    A = function (e, t) {
      return c.default.setType(e), o.StyleSheet.create({
        card: {
          width: (0, f.normalize)(342),
          height: t,
          borderRadius: (0, f.normalize)(20),
          alignItems: 'center',
          borderWidth: (0, f.normalize)(1),
          borderColor: c.default.getTheme().borderColor,
          alignSelf: 'center'
        },
        ellipsisBtn: {
          position: 'absolute',
          right: (0, f.normalize)(16),
          top: (0, f.normalize)(8),
          zIndex: 99
        },
        topicName: Object.assign({}, l.default.headerText, {
          color: c.default.getTheme().studyCardHeading,
          fontSize: (0, f.normalize)(10.5),
          lineHeight: (0, f.normalize)(16),
          textTransform: 'uppercase'
        }),
        textWrap: {
          height: .33 * t,
          width: '100%',
          justifyContent: 'center',
          zIndex: 9
        },
        textContent: {
          justifyContent: 'center',
          paddingHorizontal: (0, f.normalize)(16),
          paddingBottom: (0, f.normalize)(10)
        },
        veil: {
          position: 'absolute',
          bottom: -(0, f.normalize)(1),
          left: -(0, f.normalize)(1),
          right: -(0, f.normalize)(1),
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: c.default.getTheme().vailBackground,
          borderRadius: (0, f.normalize)(20),
          zIndex: 999
        },
        veilPortion: {
          position: 'absolute',
          left: 0,
          right: 0
        },
        bottomContent: {
          flex: 1,
          justifyContent: 'flex-end',
          paddingHorizontal: (0, f.normalize)(18)
        },
        button: {
          maxWidth: (0, f.normalize)(96),
          height: (0, f.normalize)(76),
          alignItems: 'center',
          justifyContent: 'center'
        },
        buttonOverlay: {
          position: 'absolute',
          left: -(0, f.normalize)(3),
          right: -(0, f.normalize)(3),
          top: -(0, f.normalize)(1),
          bottom: -(0, f.normalize)(1),
          backgroundColor: c.default.getTheme().buttonColor1,
          borderRadius: (0, f.normalize)(20),
          zIndex: -1
        },
        buttonContent: {
          width: '100%',
          backgroundColor: c.default.getTheme().vailBackground,
          borderWidth: (0, f.normalize)(1),
          borderColor: c.default.getTheme().borderColorSecondary,
          borderRadius: (0, f.normalize)(18),
          alignItems: 'center',
          justifyContent: 'center'
        },
        buttonsContainer: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'transparent'
        },
        popupWrap: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: .4 * t,
          justifyContent: 'center',
          alignSelf: 'center',
          zIndex: 999,
          elevation: 999
        },
        popup: {
          alignSelf: 'center',
          backgroundColor: c.default.getTheme().buttonColor1,
          paddingVertical: (0, f.normalize)(12),
          paddingHorizontal: (0, f.normalize)(32),
          borderRadius: (0, f.normalize)(24),
          justifyContent: 'center'
        },
        popupClose: {
          fontSize: (0, f.normalize)(26),
          fontFamily: l.Fonts.poppinsSemiBold,
          color: '#fff'
        },
        popupText: Object.assign({}, l.default.headerText, {
          fontSize: (0, f.normalize)(20),
          fontFamily: l.Fonts.poppinsSemiBold,
          color: '#fff'
        })
      });
    };
  _e.default = (0, a.connect)(function (e) {
    return {
      mode: e.settings.theme,
      isBottomBarExpanded: e.settings.bottomBarCompensation,
      totalCards: e.deckStats.total_cards,
      currentSession: e.deckStats.current_session,
      currentId: e.deckStats.current_id,
      currentToGraduate: e.deckStats.current_to_graduate,
      prevSession: e.deckStats.prev_session,
      prevId: e.deckStats.prev_id,
      prevToGraduate: e.deckStats.prev_to_graduate,
      gameDecks: e.deckStats.game_decks,
      decksInfo: e.deckStats.decks_info,
      lastDeckPulled: e.deckStats.last_deck_pulled,
      cardsPurchased: e.deckStats.cards_purchased,
      todaysInjections: e.deckStats.todays_injections
    };
  }, function (e) {
    return {
      setStudyEnd: function (t) {
        return e((0, b.setStudyEnd)(t));
      },
      setTotalCards: function (t) {
        return e((0, b.setTotalCards)(t));
      },
      setCurrentSession: function (t) {
        return e((0, b.setCurrentSession)(t));
      },
      setCurrentId: function (t) {
        return e((0, b.setCurrentId)(t));
      },
      setCurrentToGraduate: function (t) {
        return e((0, b.setCurrentToGraduate)(t));
      },
      visitStudyCards: function (t) {
        return e((0, b.visitStudyCards)(t));
      },
      setPrevSession: function (t) {
        return e((0, b.setPrevSession)(t));
      },
      setPrevId: function (t) {
        return e((0, b.setPrevId)(t));
      },
      setPrevToGraduate: function (t) {
        return e((0, b.setPrevToGraduate)(t));
      },
      setDecksInfo: function (t) {
        return e((0, b.setDecksInfo)(t));
      },
      setLastDeckPulled: function (t) {
        return e((0, b.setLastDeckPulled)(t));
      },
      setNewCounter: function (t) {
        return e((0, b.setNewCounter)(t));
      },
      setReviewedCounter: function (t) {
        return e((0, b.setReviewedCounter)(t));
      },
      setCompletedCounter: function (t) {
        return e((0, b.setCompletedCounter)(t));
      },
      setPrevNewCounter: function (t) {
        return e((0, b.setPrevNewCounter)(t));
      },
      setPrevReviewedCounter: function (t) {
        return e((0, b.setPrevReviewedCounter)(t));
      },
      setPrevCompletedCounter: function (t) {
        return e((0, b.setPrevCompletedCounter)(t));
      },
      setTodaysInjections: function (t) {
        return e((0, b.setTodaysInjections)(t));
      }
    };
  })(function (e) {
    var a = e.mode,
      x = e.index,
      b = e.item,
      D = e.onNext,
      H = e.withoutVeil,
      N = e.soundPlay,
      G = e.promptSoundPlay,
      V = e.fontSize,
      R = e.park,
      K = e.popupVeilShowed,
      L = (e.parkedCards, e.injections),
      W = e.setStudyEnd,
      B = e.setTotalCards,
      X = e.totalCards,
      J = e.setCurrentSession,
      U = e.setCurrentId,
      Y = e.currentSession,
      q = e.currentId,
      Q = e.setCurrentToGraduate,
      Z = (e.currentToGraduate, e.visitStudyCards),
      $ = e.setPrevSession,
      ee = e.setPrevId,
      te = e.prevSession,
      ne = e.prevId,
      re = e.setPrevToGraduate,
      ae = e.prevToGraduate,
      oe = e.gameDecks,
      ie = e.lastDeckPulled,
      ue = e.decksInfo,
      se = e.setDecksInfo,
      le = e.setLastDeckPulled,
      de = e.lastCardsInjected,
      ce = e.ToGraduate,
      fe = e.newCounter,
      pe = e.reviewedCounter,
      ge = e.completedCounter,
      he = e.prevNewCounter,
      me = e.prevReviewedCounter,
      Ce = e.prevCompletedCounter,
      ve = e.setNewCounter,
      ye = e.setReviewedCounter,
      Pe = e.setCompletedCounter,
      xe = e.setPrevNewCounter,
      Te = e.setPrevReviewedCounter,
      be = e.setPrevCompletedCounter,
      we = e.indexCarousel,
      Se = e.lastIndex,
      Fe = e.cardsPurchased,
      je = e.todaysInjections,
      ke = e.setTodaysInjections,
      De = (e.isBottomBarExpanded, (0, s.useRoute)().params || {}),
      Ie = (De.startingDecks, De.sessionCards),
      ze = (De.toGraduate, De.lDayPull),
      Me = (0, i.useSafeAreaInsets)(),
      Oe = (0, o.useWindowDimensions)().height,
      Ee = (0, r.useState)(0),
      Ae = (0, n.default)(Ee, 2),
      He = Ae[0],
      Ne = Ae[1],
      Ge = (0, r.useState)(E),
      Ve = (0, n.default)(Ge, 2),
      Re = Ve[0],
      Ke = Ve[1],
      Le = Math.max(Me.bottom, O),
      We = Re + M + Le,
      Be = Math.max(z, Oe - Me.top - Me.bottom - (0, f.normalize)(185)),
      Xe = He ? Math.max(z, He - We) : Be,
      Je = A(a, Xe),
      Ue = 'A' === Ie[x].language,
      Ye = 'B12001' !== Ie[x].ID,
      qe = (0, r.useState)(2),
      Qe = (0, n.default)(qe, 2),
      Ze = Qe[0],
      $e = Qe[1],
      et = (0, r.useState)(!0),
      tt = (0, n.default)(et, 2),
      nt = tt[0],
      rt = tt[1],
      at = (0, r.useState)(!1),
      ot = (0, n.default)(at, 2),
      it = ot[0],
      ut = ot[1],
      st = (0, r.useState)(0 === we && !ze),
      lt = (0, n.default)(st, 2),
      dt = lt[0],
      ct = lt[1],
      ft = (0, r.useState)(!ze),
      pt = (0, n.default)(ft, 2),
      gt = pt[0],
      ht = pt[1],
      mt = (0, r.useState)(2 === we),
      Ct = (0, n.default)(mt, 2),
      vt = Ct[0],
      yt = Ct[1],
      Pt = (0, r.useRef)(!1),
      xt = (0, r.useState)({
        first: null,
        second: null,
        third: null,
        language: null,
        deckName: null
      }),
      Tt = (0, n.default)(xt, 2),
      bt = Tt[0],
      wt = Tt[1],
      St = (0, s.useNavigation)(),
      Ft = (0, r.useState)(null),
      jt = (0, n.default)(Ft, 2),
      kt = (jt[0], jt[1]),
      Dt = (0, r.useCallback)((0, j.debounce)(function (e) {
        kt(e), Ht(e);
      }, 1e3, {
        leading: !0,
        trailing: !1
      }), [kt]);
    var It = function () {
      var e = (0, r.useRef)(!1);
      return (0, r.useEffect)(function () {
        return e.current = !0, function () {
          e.current = !1;
        };
      }, []), e;
    }();
    (0, r.useEffect)(function () {
      It.current && Ze <= 1 && 'E' === Gt && N(q, !0);
    }, [Ze, nt]), (0, r.useEffect)(function () {
      if (b) {
        var e = Nt(b.N),
          t = Nt(b.E),
          n = Nt(b.X),
          r = b.A,
          a = b.language,
          o = b.D;
        wt({
          first: e,
          second: t,
          third: n,
          cardLang: r,
          language: a,
          deckName: o
        });
      }
    }, [b, V]), (0, r.useEffect)(function () {
      if (o.LogBox.ignoreLogs(['new NativeEventEmitter']), R && !Pt.current) {
        Pt.current = !0;
        var e = Ie[q].DECK_ID + '_' + Ie[q].ID + Ie[q].language,
          t = new o.NativeEventEmitter('MjolnirModule').addListener('parkCard', function (t) {
            R && !Ie[q].Park && e === t && Ht('park');
          });
        return function () {
          Pt.current = !1, t.remove();
        };
      }
    }, []);
    var zt = function () {
        var e, t;
        if (null != (e = Ie[q]) && e.Graduated) {
          var n,
            r = (null == (n = Ie[q]) ? void 0 : n.CF) - 1;
          if (Ie[q].CF < 4) {
            var a = w.default.find(function (e) {
                return e.Name === Ie[q].DECK_ID;
              }),
              o = Object.assign({}, T.options.CFStage[r]),
              i = o.Hard;
            return i >= 1440 && (i = 1440 * Math.min(a.MaxInterval, i / 1440)), {
              Panic: o.Panic,
              Hard: i,
              OK: 1440 * Math.min(a.MaxInterval, o.OK / 1440),
              Easy: 1440 * Math.min(a.MaxInterval, o.Easy / 1440)
            };
          }
          if (1 === Ie[q].Panic) return {
            Panic: 1,
            Hard: 5,
            OK: 1440 * Math.round(40 * Ie[q].CF / 100),
            Easy: 1440 * Math.round(66 * Ie[q].CF / 100),
            AutoPark: !1
          };
          if (2 === Ie[q].Panic) return {
            Panic: 1,
            Hard: 5,
            OK: 1440 * Math.round(33 * Ie[q].CF / 100),
            Easy: 1440 * Math.round(50 * Ie[q].CF / 100),
            AutoPark: !1
          };
          a = w.default.find(function (e) {
            return e.Name === Ie[q].DECK_ID;
          });
          return {
            Panic: 5,
            Hard: 1440 * Math.min(a.MaxInterval, Math.round(Ie[q].CF * T.options.CF4.Hard.value / 100)),
            OK: 1440 * Math.min(a.MaxInterval, Math.round(Ie[q].CF * T.options.CF4.OK.value / 100)),
            Easy: 1440 * Math.min(a.MaxInterval, Math.round(Ie[q].CF * T.options.CF4.Easy.value / 100)),
            AutoPark: Ie[q].AutoParkHit + 1 === T.globalOptions.AutoPark
          };
        }
        return Object.assign({}, T.options.GraduationStage[null == (t = Ie[q]) ? void 0 : t.Stage]);
      },
      Mt = (0, r.useMemo)(function () {
        var e,
          t = zt(),
          n = null != (e = null == t ? void 0 : t.Panic) ? e : -1;
        return I(n);
      }, [q, we]),
      Ot = (0, r.useMemo)(function () {
        var e,
          t = zt(),
          n = null != (e = null == t ? void 0 : t.Hard) ? e : -1;
        return I(n);
      }, [q, we]),
      Et = (0, r.useMemo)(function () {
        var e,
          t = zt(),
          n = null != (e = null == t ? void 0 : t.OK) ? e : -1;
        return I(n);
      }, [q, we]),
      _t = (0, r.useMemo)(function () {
        var e = zt();
        if (e.AutoPark) return 'Archive';
        var t,
          n = null != (t = null == e ? void 0 : e.Easy) ? t : -1;
        return I(n);
      }, [q, we]),
      At = (0, r.useCallback)(function () {
        return Ie.filter(function (e) {
          return 100 === e.Stage && !0 === e.Park;
        }).length;
      }, [q]),
      Ht = function (e) {
        Rt(x, e), D();
      },
      Nt = function (e) {
        return (0, k.jsx)(y.default, {
          fontSize: V,
          content: e
        });
      },
      Gt = function () {
        if ('N' === bt.cardLang) return bt.language;
        if ('E' === bt.cardLang) {
          if ('N' === bt.language) return 'E';
          if ('E' === bt.language) return 'N';
        } else if ('X' === bt.cardLang) return 'X';
      }(),
      Vt = function (e) {
        !H && gt && 'A' != bt.language && !1 === K.current || e === Gt && G();
      },
      Rt = function (e, n) {
        var r = Ie[e].Stage;
        for (var a of (te = [], Ie)) te.push(Object.assign({}, a));
        if (ne = e, ae = ce.current.current, $(te), ee(ne), re(ae), de.current = [], he.current = fe.current, me.current = pe.current, Ce.current = ge.current, xe(he.current), Te(me.current), be(Ce.current), 'easy' !== n && 'ok' !== n && (Ie[e].AutoParkHit = 0), 'park' === n) Ie[e].Park = !0, Ie[e].Postponed = !0, Ie[e].Graduated = !0, ge.current++, Pe(ge.current), 'brand' === Ie[e].Type ? (Ie[e].Stage = 100, fe.current++, ve(fe.current)) : ('prev' === Ie[e].Type && (pe.current++, ye(pe.current)), Ie[e].Stage = 150), Ie[e].Type = 'same', ce.current.current--;else {
          var o = w.default.find(function (t) {
            return t.Name === Ie[e].DECK_ID;
          }).MaxInterval;
          if (Ie[e].Time = Kt(n, r, e, o), Ie[e].numberOfReschedulings++, e === Ie.length - 1 && 1 === ce.current.current) {
            var i = moment().subtract(4, 'hours').startOf('day'),
              u = moment(Ie[e].Time).subtract(4, 'hours').startOf('day');
            i.isSame(u, 'day') && (Ie[e].Time += 864e5, ce.current.current--);
          }
          'brand' === Ie[e].Type ? (fe.current++, ve(fe.current), Ie[e].Postponed || (Ie[e].Type = 'same')) : 'same' === Ie[e].Type ? Ie[e].Postponed : 'prev' === Ie[e].Type && (pe.current++, ye(pe.current), Ie[e].Postponed || (Ie[e].Type = 'same')), Ie[e].CF === o && T.globalOptions.isCFMaxed++, 1 === T.globalOptions.isCFMaxed && T.globalOptions.isCFMaxed++, Ie[e].AutoParkHit === T.globalOptions.AutoPark && (T.globalOptions.isFirstAutoPark || (T.globalOptions.isFirstAutoPark = !0), Ie[e].Park = !0, Ie[e].Postponed = !0, Ie[e].Graduated = !0, Ie[e].Stage = 200, ge.current++, Pe(ge.current)), Ie[e].AutoTagHit === T.globalOptions.AutoTag && (T.globalOptions.isFirstAutoTag || (T.globalOptions.isFirstAutoTag = !0), Ie[e].Tag = !0);
        }
        var s = X.findIndex(function (t) {
          return t.ID === Ie[e].ID && t.language === Ie[e].language && t.DECK_ID === Ie[e].DECK_ID;
        });
        X[s] = Object.assign({}, Ie[e]);
        var l = At();
        if (l % 5 == 0 && l / 5 > L.current && Lt(), ce.current.current <= 0) return W(new Date()), B((0, t.default)(X)), J([]), U(0), Q(0), Z(!1), void St.navigate('GreatJob');
        var c = (0, t.default)(Ie),
          f = Object.assign({}, Ie[e]),
          p = c.filter(function (e) {
            return 'same' === e.Type || 'brand' === e.Type;
          }),
          h = c.filter(function (e) {
            return 'prev' === e.Type;
          }),
          C = p.filter(function (e) {
            return e.Postponed;
          }),
          v = p.filter(function (e) {
            return !e.Postponed;
          }),
          y = h.filter(function (e) {
            return e.Postponed;
          }),
          P = h.filter(function (e) {
            return !e.Postponed;
          });
        v.forEach(function (e) {
          'brand' === e.Type && (e.Time = new Date().getTime());
        }), v.sort(function (e, t) {
          return e.Time - t.Time;
        }), P.sort(function (e, t) {
          var n = w.default.findIndex(function (t) {
              return t.Name === e.DECK_ID;
            }),
            r = w.default.findIndex(function (e) {
              return e.Name === t.DECK_ID;
            }),
            a = e.ID + e.language,
            o = t.ID + t.language,
            i = w.default[n].Cards.findIndex(function (e) {
              return e.Card === a;
            }),
            u = w.default[r].Cards.findIndex(function (e) {
              return e.Card === o;
            });
          return e.CF - t.CF || n - r || i - u;
        });
        var x = v.filter(function (e) {
            return new Date() >= new Date(e.Time);
          }),
          b = v.filter(function (e) {
            return new Date() < new Date(e.Time);
          }),
          S = [];
        S.push.apply(S, (0, t.default)(C)), S.push.apply(S, (0, t.default)(y)), S.push.apply(S, (0, t.default)(x)), S.push.apply(S, (0, t.default)(P)), S.push.apply(S, (0, t.default)(b)), Ie.splice(0, Ie.length), Ie.push.apply(Ie, S);
        var F = S.findIndex(function (e) {
          return e.ID === f.ID && e.language === f.language;
        });
        Y = (0, t.default)(Ie), J(Y), Q(ce.current.current), Se.current = F;
      },
      Kt = function (e, t, n, r) {
        if (Ie[n].Graduated) {
          var a = Ie[n].CF - 1;
          if (Ie[n].CF < 4) {
            if ('panic' === e) return Ie[n].CF = 0, Ie[n].Graduated = !1, Ie[n].Stage = 1, Ie[n].AutoTagHit++, new Date().getTime() + 6e4 * T.options.CFStage[a].Panic;
            if ('hard' === e) {
              1 === Ie[n].CF && (Ie[n].CF = 0, Ie[n].Graduated = !1, Ie[n].Stage = 3);
              var o = T.options.CFStage[a].Hard;
              return T.options.CFStage[a].Hard >= 1440 && (Ie[n].CF = Math.round(T.options.CFStage[a].Hard / 1440), ce.current.current--, Ie[n].Postponed = !0, o = 1440 * Math.min(r, T.options.CFStage[a].Hard / 1440)), new Date().getTime() + 6e4 * o;
            }
            if ('ok' === e) {
              var i, u;
              Ie[n].CF = Math.round(T.options.CFStage[a].OK / 1440), Ie[n].CF = Math.min(r, Ie[n].CF), ce.current.current--, Ie[n].Postponed = !0;
              var s = 1440 * Math.min(r, (null == (i = T.options.CFStage) || null == (u = i[a]) ? void 0 : u.OK) / 1440);
              return new Date().getTime() + 6e4 * s;
            }
            if ('easy' === e) {
              var l, c, f, p;
              Ie[n].CF = Math.round((null == (l = T.options.CFStage) || null == (c = l[a]) ? void 0 : c.Easy) / 1440), Ie[n].CF = Math.min(r, Ie[n].CF), ce.current.current--, Ie[n].Postponed = !0;
              var h = 1440 * Math.min(r, (null == (f = T.options.CFStage) || null == (p = f[a]) ? void 0 : p.Easy) / 1440);
              return new Date().getTime() + 6e4 * h;
            }
          } else if (1 === Ie[n].Panic) {
            if ('panic' === e) return Ie[n].Panic = 2, Ie[n].AutoTagHit++, new Date().getTime() + 6e4;
            if ('hard' === e) return new Date().getTime() + 3e5;
            if ('ok' === e) return Ie[n].CF = Math.round(40 * Ie[n].CF / 100), ce.current.current--, Ie[n].Panic = 0, Ie[n].Postponed = !0, new Date().getTime() + 1440 * Ie[n].CF * 6e4;
            if ('easy' === e) return Ie[n].CF = Math.round(66 * Ie[n].CF / 100), ce.current.current--, Ie[n].Panic = 0, Ie[n].Postponed = !0, new Date().getTime() + 1440 * Ie[n].CF * 6e4;
          } else if (2 === Ie[n].Panic) {
            if ('panic' === e) return Ie[n].Panic = 2, Ie[n].AutoTagHit++, new Date().getTime() + 6e4;
            if ('hard' === e) return Ie[n].Panic = 1, new Date().getTime() + 3e5;
            if ('ok' === e) return Ie[n].CF = Math.round(33 * Ie[n].CF / 100), Ie[n].Panic = 0, ce.current.current--, Ie[n].Postponed = !0, new Date().getTime() + 1440 * Ie[n].CF * 6e4;
            if ('easy' === e) return Ie[n].CF = Math.round(50 * Ie[n].CF / 100), Ie[n].Panic = 0, ce.current.current--, Ie[n].Postponed = !0, new Date().getTime() + 1440 * Ie[n].CF * 6e4;
          } else {
            if ('panic' === e) return Ie[n].Panic = 1, Ie[n].AutoTagHit++, new Date().getTime() + 3e5;
            if ('hard' === e) return Ie[n].CF = Math.round(Ie[n].CF * T.options.CF4.Hard.value / 100), Ie[n].CF = Math.min(r, Ie[n].CF), ce.current.current--, Ie[n].Postponed = !0, new Date().getTime() + 1440 * Ie[n].CF * 6e4;
            if ('ok' === e) return Ie[n].CF = Math.round(Ie[n].CF * T.options.CF4.OK.value / 100), Ie[n].CF = Math.min(r, Ie[n].CF), Ie[n].CF === r && Ie[n].AutoParkHit++, ce.current.current--, Ie[n].Postponed = !0, new Date().getTime() + 1440 * Ie[n].CF * 6e4;
            if ('easy' === e) return Ie[n].CF = Math.round(Ie[n].CF * T.options.CF4.Easy.value / 100), Ie[n].CF = Math.min(r, Ie[n].CF), Ie[n].CF === r && Ie[n].AutoParkHit++, ce.current.current--, Ie[n].Postponed = !0, new Date().getTime() + 1440 * Ie[n].CF * 6e4;
          }
        } else {
          if ('panic' === e) return t > 0 && Ie[n].Stage--, new Date().getTime() + 6e4;
          if ('hard' === e) return new Date().getTime() + 6e4 * T.options.GraduationStage[t].Hard;
          if ('ok' === e) {
            var C = new Date().getTime() + 6e4 * T.options.GraduationStage[t].OK;
            return t < 3 ? Ie[n].Stage++ : (Ie[n].Graduated = !0, Ie[n].Postponed = !0, Ie[n].CF = 1, ce.current.current--), C;
          }
          if ('easy' === e) {
            C = new Date().getTime() + 6e4 * T.options.GraduationStage[t].Easy;
            return Ie[n].Stage = Math.min(t + 2, 3), t >= 2 && (Ie[n].Graduated = !0, Ie[n].Postponed = !0, Ie[n].CF = 2, ce.current.current--), C;
          }
        }
      },
      Lt = function () {
        if (je < F.MAX_DAILY_INJECTIONS) {
          var e = S.default.drawNewCards(oe, 5, ie, ue, X, Fe);
          ie = e.lastDeckPulled, ue = e.decksInfo, X = e.totalCards, de.current = e.userDeckTmp;
          var n = [],
            r = function (e) {
              var t = X.find(function (t) {
                return t.ID === e.card.slice(0, 6) && t.language === e.card.substr(e.card.length - 1) && t.DECK_ID === e.deck;
              });
              t.Stage = 0, t.Graduated = !1, t.Type = 'brand', t.Postponed = !1, t.Time = new Date().getTime(), t.CF = 0, t.AutoParkHit = 0, t.AutoTagHit = 0, ce.current.current++, n.push(t);
            };
          for (var a of e.userDeckTmp) r(a);
          Ie.push.apply(Ie, n), le(ie), se((0, t.default)(ue)), B((0, t.default)(X)), L.current++, je++, ke(je);
        }
      },
      Wt = r.default.useRef(o.PanResponder.create({
        onMoveShouldSetPanResponderCapture: function (e, t) {
          return 0 !== t.dy;
        },
        onPanResponderRelease: function (e, t) {
          $e(1), rt(!1), ut(!0);
        }
      })).current,
      Bt = H && dt,
      Xt = !H && gt && 'A' !== bt.language && !1 === K.current,
      Jt = H && vt;
    return (0, k.jsxs)(o.View, {
      style: {
        flex: 1
      },
      onLayout: function (e) {
        var t = e.nativeEvent,
          n = Math.round(t.layout.height);
        n !== He && Ne(n);
      },
      children: [(0, k.jsxs)(o.View, {
        style: [Je.card, {
          overflow: 'hidden'
        }],
        children: [Ye && (0, k.jsx)(P.default, {
          cardHeight: Xe,
          position: Gt,
          onPress: G
        }), (0, k.jsx)(o.Text, {
          style: Je.topicName,
          children: bt.deckName
        }), (0, k.jsx)(o.TouchableOpacity, {
          onPress: function () {
            return Vt('A' === bt.language ? 'A' : 'N');
          },
          activeOpacity: 1,
          style: [Je.textWrap, Je.textContent, {
            height: .29 * Xe,
            paddingVertical: (0, f.normalize)(8)
          }],
          children: !H && Ue && Ze > 1 ? (0, k.jsx)(o.TouchableOpacity, {
            onPress: G,
            children: (0, k.jsx)(o.Text, {
              style: [l.default.headerText, {
                color: c.default.getTheme().headingGray,
                fontSize: (0, f.normalize)(18)
              }],
              children: c.default.getTheme().listening
            })
          }) : 'N' === bt.language || 'A' === bt.language ? bt.first : bt.second
        }), (0, k.jsx)(o.View, {
          style: l.default.textDivider
        }), (0, k.jsx)(o.View, {
          style: [Je.textWrap, {
            height: .29 * Xe,
            paddingVertical: (0, f.normalize)(8)
          }],
          children: (0, k.jsx)(o.ScrollView, {
            style: {
              flex: 1
            },
            contentContainerStyle: {
              justifyContent: 'center'
            },
            children: (0, k.jsx)(o.TouchableOpacity, {
              onPress: function () {
                return Vt('E');
              },
              activeOpacity: 1,
              style: [Je.textContent, {
                minHeight: .29 * Xe - (0, f.normalize)(16)
              }],
              children: 'N' === bt.language || 'A' === bt.language ? bt.second : bt.first
            })
          })
        }), (0, k.jsx)(o.View, {
          style: l.default.textDivider
        }), (0, k.jsx)(o.ScrollView, {
          style: [{
            height: .4 * Xe,
            paddingVertical: (0, f.normalize)(8),
            width: '100%',
            zIndex: 9,
            marginVertical: (0, f.normalize)(8)
          }],
          contentContainerStyle: {
            flexGrow: 1,
            justifyContent: 'center'
          },
          children: (0, k.jsx)(o.TouchableOpacity, {
            onPress: function () {
              return Vt('X');
            },
            activeOpacity: 1,
            style: Je.textContent,
            children: bt.third
          })
        }), !H && nt && (0, k.jsxs)(o.View, Object.assign({}, Wt.panHandlers, {
          style: [l.shadow, Je.veil, {
            height: 2 === Ze ? .7 * Xe - 7 : 1 === Ze ? .4 * Xe - 7 : void 0
          }],
          children: [Ze >= 2 && (0, k.jsx)(o.Pressable, {
            style: [Je.veilPortion, {
              top: 0,
              height: .29 * Xe
            }],
            onPress: function () {
              $e(1), ut(!0);
            }
          }), Ze >= 1 && (0, k.jsx)(o.Pressable, {
            style: [Je.veilPortion, {
              top: 1 === Ze ? 0 : .29 * Xe,
              height: .4 * Xe
            }],
            onPress: function () {
              $e(1), rt(!1), ut(!0);
            }
          }), (0, k.jsx)(o.Pressable, {
            onPress: function () {
              $e(1), rt(!1), ut(!0);
            },
            children: c.default.getTheme().veilArrow
          })]
        })), Bt && (0, k.jsx)(u.View, {
          style: [Je.popupWrap, {
            bottom: (0, f.normalize)(10)
          }],
          animation: 'fadeIn',
          delay: 4e3,
          duration: 250,
          children: (0, k.jsxs)(o.Pressable, {
            style: Je.popup,
            onPress: function () {
              return ct(!1);
            },
            children: [(0, k.jsx)(o.TouchableOpacity, {
              style: {
                position: 'absolute',
                top: (0, f.normalize)(4),
                right: (0, f.normalize)(16)
              },
              onPress: function () {
                return ct(!1);
              },
              children: (0, k.jsx)(o.Text, {
                style: Je.popupClose,
                children: "\xd7"
              })
            }), (0, k.jsx)(o.Text, {
              style: Je.popupText,
              children: 'How was\nthis flashcard?\nHard, Normal\nor Easy?'
            })]
          })
        }), Xt && (0, k.jsx)(u.View, {
          style: [Je.popupWrap, {
            height: .7 * Xe
          }],
          animation: 'fadeIn',
          delay: 0,
          duration: 250,
          children: (0, k.jsxs)(o.Pressable, {
            style: Je.popup,
            onPress: function () {
              ht(!1), K.current = !0;
            },
            children: [(0, k.jsx)(o.TouchableOpacity, {
              style: {
                position: 'absolute',
                top: (0, f.normalize)(4),
                right: (0, f.normalize)(16)
              },
              onPress: function () {
                ht(!1), K.current = !0;
              },
              children: (0, k.jsx)(o.Text, {
                style: Je.popupClose,
                children: "\xd7"
              })
            }), (0, k.jsx)(o.Text, {
              style: Je.popupText,
              children: 'Think of the\nanswer and\ntap to reveal it'
            })]
          })
        }), Jt && (0, k.jsx)(u.View, {
          style: [Je.popupWrap, {
            bottom: (0, f.normalize)(10)
          }],
          animation: 'fadeIn',
          delay: 0,
          duration: 0,
          children: (0, k.jsxs)(o.Pressable, {
            style: Je.popup,
            onPress: function () {
              return yt(!1);
            },
            children: [(0, k.jsx)(o.TouchableOpacity, {
              style: {
                position: 'absolute',
                top: (0, f.normalize)(4),
                right: (0, f.normalize)(16)
              },
              onPress: function () {
                return yt(!1);
              },
              children: (0, k.jsx)(o.Text, {
                style: Je.popupClose,
                children: "\xd7"
              })
            }), (0, k.jsx)(o.Text, {
              style: Je.popupText,
              children: "Use the\ntop right button\nto archive cards\nyou don't want\nto see again"
            })]
          })
        })]
      }), (0, k.jsx)(o.View, {
        style: [Je.bottomContent, {
          paddingTop: M,
          paddingBottom: Le
        }],
        children: (0, k.jsxs)(o.View, {
          style: [Je.buttonsContainer, !(H || it) && {
            opacity: 0
          }],
          pointerEvents: H || it ? 'auto' : 'none',
          onLayout: function (e) {
            var t = e.nativeEvent,
              n = Math.round(t.layout.height);
            n !== Re && Ke(n);
          },
          children: [!H && '-1' !== Mt && (0, k.jsx)(_, {
            mode: a,
            onPress: function () {
              return Dt('panic');
            },
            title: 'Wrong',
            text: Mt,
            icon: (0, k.jsx)(p.default, {
              width: (0, f.normalize)(32),
              height: (0, f.normalize)(32)
            }),
            withoutVeil: !0,
            disabled: Bt || Xt || Jt,
            isFeelPopupShown: Bt
          }), (0, k.jsx)(_, {
            mode: a,
            onPress: function () {
              return Dt('hard');
            },
            title: 'Hard',
            text: Ot,
            icon: (0, k.jsx)(h.default, {
              width: (0, f.normalize)(32),
              height: (0, f.normalize)(32)
            }),
            withoutVeil: !0,
            disabled: Bt || Xt || Jt,
            isFeelPopupShown: Bt
          }), (0, k.jsx)(_, {
            mode: a,
            onPress: function () {
              return Dt('ok');
            },
            title: 'Normal',
            text: Et,
            icon: (0, k.jsx)(C.default, {
              width: (0, f.normalize)(32),
              height: (0, f.normalize)(32)
            }),
            withoutVeil: !0,
            disabled: Bt || Xt || Jt,
            isFeelPopupShown: Bt
          }), (0, k.jsx)(_, {
            mode: a,
            onPress: function () {
              return Dt('easy');
            },
            title: 'Easy',
            text: _t,
            icon: (0, k.jsx)(v.default, {
              width: (0, f.normalize)(32),
              height: (0, f.normalize)(32)
            }),
            withoutVeil: !0,
            disabled: Bt || Xt || Jt,
            isFeelPopupShown: Bt
          })]
        })
      })]
    });
  });
}, 2131, [1, 11, 56, 77, 892, 5, 944, 1414, 990, 1406, 1252, 1243, 2132, 2025, 2026, 2027, 1441, 2008, 2028, 2133, 1408, 2111, 2110, 966, 2029, 80]);