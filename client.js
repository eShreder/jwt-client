import pipe from 'lodash/fp/pipe'
import toString from 'lodash/fp/toString'

import { jwtDecode, parseJSON } from './helpers'

class Client {
    static _version = '0.2.0'
    static TOLERANCE_EXP_TIME = 30000 // Предупреждать о необходимости обновить токен за 30 секунд
    static EMPTY_ACCESS_TOKEN = 'Client.EMPTY_ACCESS_TOKEN'
    static EMPTY_REFRESH_TOKEN = 'Client.EMPTY_REFRESH_TOKEN'
    static ERROR_INIT_CREDENTIALS = 'Client.ERROR_INIT_CREDENTIALS'
    static EXPIRED_TOKEN = 'Client/EXPIRED_TOKEN'
    static REQUEST_UPDATE_CREDENTIAL = 'Client/REQUEST_UPDATE_CREDENTIAL'
    static SET_CREDENTIALS = 'Client/SET_CREDENTIALS'
    static WRONG_ACCESS_TOKEN = 'Client/WRONG_ACCESS_TOKEN'
    static WRONG_REFRESH_TOKEN = 'Client/WRONG_REFRESH_TOKEN'

    constructor({
        store = defaultStore,
        emitter: parentEmitter,
        keyStore = 'credentials',
    } = {}) {
        const tokens = {
            access_token: null,
            refresh_token: null,
        }
        const emitter = parentEmitter
        let data = null
        let timeoutId = null
        // Загрузка информации из токена
        const loadTokens = pipe([store.getItem, toString, parseJSON])

        Object.defineProperties(this, {
            info: {
                get() {
                    return data
                        ? {
                              ...data,
                              _isExpiredToken: data.exp * 1000 < Date.now(),
                          }
                        : data
                },
                set() {
                    throw new Error('read-only property')
                },
            },
        })

        this.setCredentials = ({ access_token, refresh_token }) => {
            try {
                ;({ data } = jwtDecode(access_token))
                tokens.access_token = access_token
            } catch (error) {
                emitter.emit(Client.WRONG_ACCESS_TOKEN, {
                    access_token,
                    error,
                })
                throw new Error(Client.WRONG_ACCESS_TOKEN)
            }

            try {
                atob(refresh_token)
                tokens.refresh_token = refresh_token
            } catch (error) {
                emitter.emit(Client.WRONG_REFRESH_TOKEN, {
                    refresh_token,
                    error,
                })
                throw new Error(Client.WRONG_REFRESH_TOKEN)
            }

            if (data && data.exp) {
                if (timeoutId) {
                    clearTimeout(timeoutId)
                }

                timeoutId = setTimeout(
                    () =>
                        emitter.emit(Client.REQUEST_UPDATE_CREDENTIAL, {
                            refresh_token,
                        }),
                    data.exp * 1000 - Date.now() - Client.TOLERANCE_EXP_TIME
                )
            }

            emitter.emit(Client.SET_CREDENTIALS, {
                data: this.info,
                access_token,
                refresh_token,
            })

            store.setItem(
                keyStore,
                JSON.stringify({ access_token, refresh_token })
            )
        }

        this.getCredentialsHeader = () =>
            tokens.access_token
                ? {
                      Authorization: `Bearer ${tokens.access_token}`,
                  }
                : {}

        this.getRefreshToken = () => tokens.refresh_token

        function init() {
            try {
                const { access_token, refresh_token } = loadTokens(
                    keyStore
                )

                if (!access_token) {
                    emitter.emit(Client.EMPTY_ACCESS_TOKEN)
                }
                if (!refresh_token) {
                    emitter.emit(Client.EMPTY_REFRESH_TOKEN)
                }

                if (access_token && refresh_token) {
                    this.setCredentials({ access_token, refresh_token })
                }
            } catch (error) {
                emitter.emit(Client.ERROR_INIT_CREDENTIALS, error)
            }
        }

        init.call(this)
    }
}

export default Client
