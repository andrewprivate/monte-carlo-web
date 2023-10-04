export const Grammar = {
  RegExpID: 'RE::',
  Style: {
    comment: 'comment',
    builtin: 'keyword',
    number: 'constant.numeric'
  },
  Lex: {
    comment: {
      type: 'comment',
      interleave: true,
      tokens: [
        [
          '#',
          null
        ]
      ]
    },
    number: [
      'RE::/\\d*\\.\\d+([eE][\\+\\-]?\\d+)?/',
      'RE::/\\d+\\.\\d*/',
      'RE::/\\.\\d+/',
      'RE::/[1-9]\\d*([eE][\\+\\-]?\\d+)?L?/',
      'RE::/0(?![\\dx])/'
    ],
    string: {
      type: 'simple',
      tokens:
            [
              'RE::/[^#]/',
              1
            ]
    },
    builtin: {
      autocomplete: false,
      tokens: [
        'A',
        'B',
        'A1',
        'B1',
        'InParm',
        'RAT',
        'A_l',
        'A_z',
        'Rd_r',
        'Rd_a',
        'Tt_r',
        'Tt_a',
        'A_rz',
        'Rd_ra',
        'Tt_ra'
      ]
    }
  },
  Parser: [
    [
      'comment'
    ],
    [
      'number'
    ],
    [
      'builtin'
    ]
  ]
}
